const logplease = require('logplease');
const { v4: uuidv4 } = require('uuid');
const cp = require('child_process');
const path = require('path');
const config = require('./config');
const fs = require('fs/promises');
const globals = require('./globals');

const logger = logplease.create('job');

const job_states = {
    READY: Symbol('Ready to be primed'),
    PRIMED: Symbol('Primed and ready for execution'),
    EXECUTED: Symbol('Executed and ready for cleanup'),
};

const MAX_BOX_ID = 999;
const ISOLATE_PATH = '/usr/local/bin/isolate';
let box_id = 0;

let remaining_job_spaces = config.max_concurrent_jobs;
let job_queue = [];

const get_next_box_id = () => ++box_id % MAX_BOX_ID;

// ─── Box Pool ────────────────────────────────────────────────────────────────
// Oldindan tayyor isolate boxlar saqlanadi.
// BOX_POOL_SIZE ni config dan yoki default 10 dan oladi.
const BOX_POOL_SIZE = config.box_pool_size ?? 10;
const box_pool = [];
let pool_initialized = false;

async function _init_one_box() {
    const id = get_next_box_id();
    const metadata_file_path = `/tmp/${id}-metadata.txt`;
    const stdout = await new Promise((res, rej) => {
        cp.exec(`isolate --init --cg -b${id}`, (err, out, stderr) => {
            if (err) rej(new Error(`isolate --init failed: ${err.message}\n${stderr}`));
            else if (!out.trim()) rej(new Error('isolate --init returned empty stdout'));
            else res(out);
        });
    });
    return {
        id,
        metadata_file_path,
        dir: `${stdout.trim()}/box`,
        in_use: false,
    };
}

/**
 * Server start bo'lganda bir marta chaqiriladi.
 * BOX_POOL_SIZE ta box parallel ravishda init qilinadi.
 */
async function init_box_pool() {
    if (pool_initialized) return;
    pool_initialized = true;
    logger.info(`Initializing box pool (size=${BOX_POOL_SIZE})`);
    const boxes = await Promise.all(
        Array.from({ length: BOX_POOL_SIZE }, () => _init_one_box())
    );
    box_pool.push(...boxes);
    logger.info('Box pool ready');
}

/** Pool dan bo'sh box oladi; yo'q bo'lsa yangi ochadi. */
async function acquire_box() {
    const free = box_pool.find(b => !b.in_use);
    if (free) {
        free.in_use = true;
        return free;
    }
    // Pool tugagan — yangi box ochish
    logger.warn('Box pool exhausted, opening a fresh box');
    const box = await _init_one_box();
    box.in_use = true;
    box_pool.push(box);
    return box;
}

/** Boxni tozalab poolga qaytaradi. */
async function release_box(box) {
    // Metadatani o'chirish
    await fs.rm(box.metadata_file_path).catch(() => {});

    // Boxni cleanup qilmasdan fayllarni o'chirib qayta ishlatish imkoni yo'q,
    // shuning uchun cleanup + qayta init qilamiz (background da)
    cp.exec(`isolate --cleanup --cg -b${box.id}`, async err => {
        if (err) {
            logger.error(`isolate --cleanup failed on box #${box.id}: ${err.message}`);
            // Pooldan olib tashlash
            const idx = box_pool.indexOf(box);
            if (idx !== -1) box_pool.splice(idx, 1);
            return;
        }
        // Qayta init
        try {
            const stdout = await new Promise((res, rej) => {
                cp.exec(`isolate --init --cg -b${box.id}`, (e, out) =>
                    e ? rej(e) : res(out)
                );
            });
            box.dir = `${stdout.trim()}/box`;
            box.metadata_file_path = `/tmp/${box.id}-metadata.txt`;
            box.in_use = false;
            logger.debug(`Box #${box.id} recycled back to pool`);
        } catch (e) {
            logger.error(`Failed to re-init box #${box.id}: ${e.message}`);
            const idx = box_pool.indexOf(box);
            if (idx !== -1) box_pool.splice(idx, 1);
        }
    });
}

// ─── Runtime Baselines ───────────────────────────────────────────────────────
const runtime_baselines = new Map();

async function measure_runtime_baseline(runtime) {
    if (runtime_baselines.has(runtime.language)) {
        return runtime_baselines.get(runtime.language);
    }

    const box = await acquire_box();
    const baseline_meta = `/tmp/baseline-${runtime.language}-${box.id}.txt`;

    try {
        const submission_dir = path.join(box.dir, 'submission');
        await fs.mkdir(submission_dir, { recursive: true });
        await fs.writeFile(path.join(submission_dir, 'empty.code'), '');

        await new Promise(res => {
            cp.exec(
                `isolate --run --cg -b${box.id} --meta=${baseline_meta} -s -- /bin/bash ${path.join(runtime.pkgdir, 'run')} empty.code 2>/dev/null`,
                () => res()
            );
        });

        let baseline = 0;
        try {
            const meta = (await fs.readFile(baseline_meta)).toString();
            const match = meta.match(/max-rss:(\d+)/);
            if (match) baseline = parseInt(match[1]) * 1024;
        } catch (_) {}

        runtime_baselines.set(runtime.language, baseline);
        logger.debug(`Baseline for ${runtime.language}: ${baseline} bytes`);
        return baseline;
    } catch (_) {
        runtime_baselines.set(runtime.language, 0);
        return 0;
    } finally {
        await release_box(box);
        fs.rm(baseline_meta).catch(() => {});
    }
}

/**
 * Server start da barcha runtimelar uchun baseline o'lchaydi.
 * Bu birinchi job kelganda kutishni yo'q qiladi.
 */
async function warmup_baselines(runtimes) {
    logger.info(`Warming up baselines for ${runtimes.length} runtime(s)`);
    await Promise.all(runtimes.map(rt => measure_runtime_baseline(rt)));
    logger.info('Baseline warmup complete');
}

// ─── Job ─────────────────────────────────────────────────────────────────────
class Job {
    // Compile + run uchun ishlatiladigan boxlar (cleanup uchun saqlanadi)
    #acquired_boxes;

    constructor({ runtime, files, args, stdin, timeouts, cpu_times, memory_limits }) {
        this.uuid = uuidv4();
        this.logger = logplease.create(`job/${this.uuid}`);
        this.runtime = runtime;
        this.files = files.map((file, i) => ({
            name: file.name || `file${i}.code`,
            content: file.content,
            encoding: ['base64', 'hex', 'utf8'].includes(file.encoding)
                ? file.encoding
                : 'utf8',
        }));
        this.args = args;
        this.stdin = stdin;
        if (this.stdin.slice(-1) !== '\n') {
            this.stdin += '\n';
        }
        this.timeouts = timeouts;
        this.cpu_times = cpu_times;
        this.memory_limits = memory_limits;
        this.state = job_states.READY;
        this.#acquired_boxes = [];
    }

    /** Pool dan box oladi va dirty listga qo'shadi (cleanup uchun). */
    async #get_box() {
        const box = await acquire_box();
        this.#acquired_boxes.push(box);
        return box;
    }

    async prime() {
        if (remaining_job_spaces < 1) {
            this.logger.info('Awaiting job slot');
            await new Promise(resolve => job_queue.push(resolve));
        }
        this.logger.info('Priming job');
        remaining_job_spaces--;

        const box = await this.#get_box();

        // ✅ Barcha fayllarni parallel yozish
        this.logger.debug('Writing submission files (parallel)');
        const submission_dir = path.join(box.dir, 'submission');
        await fs.mkdir(submission_dir);

        await Promise.all(
            this.files.map(async file => {
                const file_path = path.join(submission_dir, file.name);
                const rel = path.relative(submission_dir, file_path);
                if (rel.startsWith('..')) {
                    throw new Error(
                        `File path "${file.name}" tries to escape parent directory: ${rel}`
                    );
                }
                const file_content = Buffer.from(file.content, file.encoding);
                await fs.mkdir(path.dirname(file_path), { recursive: true, mode: 0o700 });
                await fs.writeFile(file_path, file_content);
            })
        );

        // Baseline allaqachon warmup da o'lchangan — bu yerda kutish yo'q
        if (!runtime_baselines.has(this.runtime.language)) {
            this.logger.debug(`Baseline missing for ${this.runtime.language}, measuring now`);
            await measure_runtime_baseline(this.runtime);
        }

        this.state = job_states.PRIMED;
        this.logger.debug('Job primed');
        return box;
    }

    async safe_call(box, file, args, timeout, cpu_time, memory_limit, event_bus = null) {
        let stdout = '';
        let stderr = '';
        let output = '';
        let memory = null;
        let code = null;
        let signal = null;
        let message = null;
        let status = null;
        let cpu_time_stat = null;
        let wall_time_stat = null;

        const wall_start = process.hrtime.bigint();

        const proc = cp.spawn(
            ISOLATE_PATH,
            [
                '--run',
                `-b${box.id}`,
                `--meta=${box.metadata_file_path}`,
                '--cg',
                '-s',
                '-c',
                '/box/submission',
                '-E',
                'HOME=/tmp',
                ...this.runtime.env_vars.flatMap(v => ['-E', v]),
                '-E',
                `COMPILER_LANGUAGE=${this.runtime.language}`,
                `--dir=${this.runtime.pkgdir}`,
                `--dir=/etc:noexec`,
                `--processes=${this.runtime.max_process_count}`,
                `--open-files=${this.runtime.max_open_files}`,
                `--fsize=${Math.floor(this.runtime.max_file_size / 1000)}`,
                `--wall-time=${timeout / 1000}`,
                `--time=${cpu_time / 1000}`,
                `--extra-time=0`,
                ...(memory_limit >= 0 ? [`--cg-mem=${Math.floor(memory_limit / 1000)}`] : []),
                ...(config.disable_networking ? [] : ['--share-net']),
                '--',
                '/bin/bash',
                path.join(this.runtime.pkgdir, file),
                ...args,
            ],
            { stdio: 'pipe' }
        );

        if (event_bus === null) {
            proc.stdin.write(this.stdin);
            proc.stdin.end();
            proc.stdin.destroy();
        } else {
            event_bus.on('stdin', data => proc.stdin.write(data));
            event_bus.on('kill', sig => proc.kill(sig));
        }

        proc.stderr.on('data', data => {
            if (event_bus !== null) {
                event_bus.emit('stderr', data);
            } else if (stderr.length + data.length > this.runtime.output_max_size) {
                message = 'stderr length exceeded';
                status = 'EL';
                this.logger.info(message);
                try { process.kill(proc.pid, 'SIGABRT'); } catch (e) {
                    this.logger.debug(`SIGABRT error: ${e}`);
                }
            } else {
                stderr += data;
                output += data;
            }
        });

        proc.stdout.on('data', data => {
            if (event_bus !== null) {
                event_bus.emit('stdout', data);
            } else if (stdout.length + data.length > this.runtime.output_max_size) {
                message = 'stdout length exceeded';
                status = 'OL';
                this.logger.info(message);
                try { process.kill(proc.pid, 'SIGABRT'); } catch (e) {
                    this.logger.debug(`SIGABRT error: ${e}`);
                }
            } else {
                stdout += data;
                output += data;
            }
        });

        const exit_data = await new Promise((res, rej) => {
            proc.on('exit', (_, sig) => res({ signal: sig }));
            proc.on('error', err => rej({ error: err }));
        });

        const wall_end = process.hrtime.bigint();
        const real_time = Math.round(Number(wall_end - wall_start) / 1_000_000);

        try {
            const metadata_str = (await fs.readFile(box.metadata_file_path)).toString();
            for (const line of metadata_str.split('\n')) {
                if (!line) continue;
                const sep = line.indexOf(':');
                if (sep === -1) throw new Error(`Bad metadata line: ${line}`);
                const key = line.slice(0, sep).trim();
                const value = line.slice(sep + 1).trim();
                switch (key) {
                    case 'cg-mem':      memory = parseInt(value) * 1000; break;
                    case 'max-rss':     memory = memory ?? parseInt(value) * 1024; break;
                    case 'exitcode':    code = parseInt(value); break;
                    case 'exitsig':     signal = globals.SIGNALS[parseInt(value)] ?? null; break;
                    case 'message':     message = message || value; break;
                    case 'status':      status = status || value; break;
                    case 'time':        cpu_time_stat = parseFloat(value) * 1000; break;
                    case 'time-wall':   wall_time_stat = parseFloat(value) * 1000; break;
                }
            }
        } catch (e) {
            throw new Error(
                `Error reading metadata file: ${box.metadata_file_path}\n` +
                `Error: ${e.message}\nstdout: ${stdout}\nstderr: ${stderr}`
            );
        }

        const baseline = runtime_baselines.get(this.runtime.language) ?? 0;
        const code_memory = memory !== null ? Math.max(0, memory - baseline) : null;

        return {
            ...exit_data,
            stdout,
            stderr,
            code,
            signal: ['TO', 'OL', 'EL'].includes(status) ? 'SIGKILL' : signal,
            output,
            message,
            status,
            cpu_time: cpu_time_stat,
            wall_time: wall_time_stat,
            real_time,
            memory: code_memory,
        };
    }

    async execute(box, event_bus = null) {
        if (this.state !== job_states.PRIMED) {
            throw new Error('Job must be in primed state, current state: ' + this.state.toString());
        }

        this.logger.info(`Executing job runtime=${this.runtime.toString()}`);

        const code_files =
            (this.runtime.language === 'file' && this.files) ||
            this.files.filter(f => f.encoding === 'utf8');

        let compile;
        let compile_errored = false;

        const emit_result = event_bus
            ? (stage, result) => {
                  const { error, code, signal } = result;
                  event_bus.emit('exit', stage, { error, code, signal });
              }
            : () => {};

        const emit_stage = event_bus
            ? stage => event_bus.emit('stage', stage)
            : () => {};

        if (this.runtime.compiled) {
            this.logger.debug('Compiling');
            emit_stage('compile');
            compile = await this.safe_call(
                box,
                'compile',
                code_files.map(x => x.name),
                this.timeouts.compile,
                this.cpu_times.compile,
                this.memory_limits.compile,
                event_bus
            );
            emit_result('compile', compile);
            compile_errored = compile.code !== 0;

            if (!compile_errored) {
                // ✅ Yangi box ochib fayl ko'chirish o'rniga,
                // compile + run uchun bitta boxdan foydalanamiz.
                // Run skripti compile chiqdi fayllarni submission/ ichida topadi.
                // (Agar runtime xavfsizlik sababli alohida box talab qilsa,
                //  quyidagi blokni yoqing.)

                // --- Ixtiyoriy: alohida run box kerak bo'lsa ---
                // const old_submission = path.join(box.dir, 'submission');
                // const run_box = await this.#get_box();
                // await fs.rename(old_submission, path.join(run_box.dir, 'submission'));
                // box = run_box;
                // ------------------------------------------------
            }
        }

        let run;
        if (!compile_errored) {
            this.logger.debug('Running');
            emit_stage('run');
            run = await this.safe_call(
                box,
                'run',
                [code_files[0].name, ...this.args],
                this.timeouts.run,
                this.cpu_times.run,
                this.memory_limits.run,
                event_bus
            );
            emit_result('run', run);
        }

        this.state = job_states.EXECUTED;

        return {
            compile,
            run,
            language: this.runtime.language,
            version: this.runtime.version.raw,
        };
    }

    async cleanup() {
        this.logger.info('Cleaning up job');
        remaining_job_spaces++;
        if (job_queue.length > 0) {
            job_queue.shift()();
        }
        // Barcha boxlarni parallel ravishda poolga qaytarish
        await Promise.all(this.#acquired_boxes.map(box => release_box(box)));
    }
}

module.exports = { Job, init_box_pool, warmup_baselines };