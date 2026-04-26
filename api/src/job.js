const logplease = require('logplease');
const { v4: uuidv4 } = require('uuid');
const cp = require('child_process');
const path = require('path');
const config = require('./config');
const fs = require('fs/promises');
const globals = require('./globals');

// Cache log level at startup so _shouldLog doesn't re-read process.env every call
const LOG_LEVEL = (config.log_level || 'INFO').toUpperCase();
const IS_DEBUG = LOG_LEVEL === 'DEBUG';
logplease.setLogLevel(LOG_LEVEL);

const job_states = {
    READY: Symbol('Ready to be primed'),
    PRIMED: Symbol('Primed and ready for execution'),
    EXECUTED: Symbol('Executed and ready for cleanup'),
};

const ISOLATE_PATH = '/usr/local/bin/isolate';

let remaining_job_spaces = config.max_concurrent_jobs;
let job_queue = [];

// Fixed ID pool: each ID is in exactly one state (free / in-use) at all times.
// A simple counter wraps around and reuses IDs that are still live — that causes
// EACCES when isolate --init re-initialises a box that hasn't been cleaned up yet.
const TOTAL_BOX_IDS = Math.max(config.max_concurrent_jobs * 6, 64);
const free_box_ids = Array.from({ length: TOTAL_BOX_IDS }, (_, i) => i + 1);

function acquire_box_id() {
    if (free_box_ids.length === 0) throw new Error('No free isolate box IDs available');
    return free_box_ids.shift();
}

function release_box_id(id) {
    free_box_ids.push(id);
}

const runtime_baselines = new Map();
const baseline_promises = new Map();

// Pre-warmed box pool — eliminates isolate --init latency from the critical path
// Compiled languages need 2 boxes per job (compile + run), so size = jobs * 2
const BOX_POOL_SIZE = Math.min(config.max_concurrent_jobs * 2, 40);
const box_pool = [];

function spawn_box_into_pool() {
    const bid = acquire_box_id();
    cp.exec(`isolate --init --cg -b${bid}`, (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
            box_pool.push({
                id: bid,
                metadata_file_path: `/tmp/${bid}-metadata.txt`,
                dir: `${stdout.trim()}/box`,
            });
        } else {
            // init failed — return the ID immediately so it can be reused
            release_box_id(bid);
        }
    });
}

// Stagger pool init: concurrent isolate --init calls can leave boxes in a broken
// state due to cgroup resource contention. Spacing them 50ms apart prevents this.
(function fill_pool_staggered(i) {
    if (i >= BOX_POOL_SIZE) return;
    spawn_box_into_pool();
    setTimeout(() => fill_pool_staggered(i + 1), 50);
})(0);

async function measure_runtime_baseline(runtime) {
    if (runtime_baselines.has(runtime.language)) {
        return runtime_baselines.get(runtime.language);
    }
    // Reuse in-flight promise to prevent duplicate measurements for same language
    if (baseline_promises.has(runtime.language)) {
        return baseline_promises.get(runtime.language);
    }

    const promise = (async () => {
        const bid = acquire_box_id();
        const baseline_meta = `/tmp/baseline-${runtime.language}-${bid}.txt`;
        try {
            const box_dir = await new Promise((res, rej) => {
                cp.exec(`isolate --init --cg -b${bid}`, (err, stdout) => {
                    if (err) rej(err);
                    else res(`${stdout.trim()}/box`);
                });
            });

            const submission_dir = path.join(box_dir, 'submission');
            await fs.mkdir(submission_dir, { recursive: true });
            await fs.writeFile(path.join(submission_dir, 'empty.code'), '');

            await new Promise(res => {
                cp.exec(
                    `isolate --run --cg -b${bid} --meta=${baseline_meta} -s -- /bin/bash ${path.join(runtime.pkgdir, 'run')} empty.code 2>/dev/null`,
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
            return baseline;
        } catch (_) {
            runtime_baselines.set(runtime.language, 0);
            return 0;
        } finally {
            baseline_promises.delete(runtime.language);
            cp.exec(`isolate --cleanup --cg -b${bid}`, () => release_box_id(bid));
            fs.rm(baseline_meta).catch(() => {});
        }
    })();

    baseline_promises.set(runtime.language, promise);
    return promise;
}

class Job {
    #dirty_boxes;
    constructor({
        runtime,
        files,
        args,
        stdin,
        timeouts,
        cpu_times,
        memory_limits,
    }) {
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
        this.#dirty_boxes = [];
    }

    async #create_isolate_box() {
        let box;
        if (box_pool.length > 0) {
            box = box_pool.shift();
            // Aggressively refill: compiled jobs consume 2 boxes each, so spawn 2 back
            setImmediate(() => {
                spawn_box_into_pool();
                if (box_pool.length < BOX_POOL_SIZE / 2) spawn_box_into_pool();
            });
        } else {
            const bid = acquire_box_id();
            const stdout = await new Promise((res, rej) => {
                cp.exec(
                    `isolate --init --cg -b${bid}`,
                    (error, out, stderr) => {
                        if (error) {
                            release_box_id(bid);
                            rej(`Failed to run isolate --init: ${error.message}\nstdout: ${out}\nstderr: ${stderr}`);
                        } else if (!out) {
                            release_box_id(bid);
                            rej('Received empty stdout from isolate --init');
                        } else {
                            res(out);
                        }
                    }
                );
            });
            box = {
                id: bid,
                metadata_file_path: `/tmp/${bid}-metadata.txt`,
                dir: `${stdout.trim()}/box`,
            };
        }
        this.#dirty_boxes.push(box);
        return box;
    }

    async prime() {
        if (remaining_job_spaces < 1) {
            this.logger.info(`Awaiting job slot`);
            await new Promise(resolve => {
                job_queue.push(resolve);
            });
        }
        this.logger.info(`Priming job`);
        remaining_job_spaces--;

        // Start baseline measurement concurrently with box creation
        const baseline_promise = measure_runtime_baseline(this.runtime);

        const box = await this.#create_isolate_box();

        const submission_dir = path.join(box.dir, 'submission');
        await fs.mkdir(submission_dir);

        // Write all submission files in parallel
        await Promise.all(
            this.files.map(async file => {
                const file_path = path.join(submission_dir, file.name);
                const rel = path.relative(submission_dir, file_path);
                if (rel.startsWith('..'))
                    throw Error(`File path "${file.name}" tries to escape parent directory: ${rel}`);
                const file_content = Buffer.from(file.content, file.encoding);
                await fs.mkdir(path.dirname(file_path), { recursive: true, mode: 0o700 });
                await fs.writeFile(file_path, file_content);
            })
        );

        this.state = job_states.PRIMED;
        return box;
    }

    async safe_call(box, file, args, timeout, cpu_time, memory_limit, event_bus = null) {
        // Use Buffer chunks to avoid O(n²) string concatenation on large outputs
        const stdout_chunks = [];
        const stderr_chunks = [];
        const output_chunks = [];
        let stdout_size = 0;
        let stderr_size = 0;
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
                `PISTON_LANGUAGE=${this.runtime.language}`,
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
            event_bus.on('stdin', data => {
                proc.stdin.write(data);
            });
            event_bus.on('kill', signal => {
                proc.kill(signal);
            });
        }

        proc.stderr.on('data', data => {
            if (event_bus !== null) {
                event_bus.emit('stderr', data);
            } else if (stderr_size + data.length > this.runtime.output_max_size) {
                message = 'stderr length exceeded';
                status = 'EL';
                this.logger.info(message);
                try {
                    process.kill(proc.pid, 'SIGABRT');
                } catch (e) {
                    if (IS_DEBUG) this.logger.debug(`Got error while SIGABRTing process ${proc}:`, e);
                }
            } else {
                stderr_size += data.length;
                stderr_chunks.push(data);
                output_chunks.push(data);
            }
        });

        proc.stdout.on('data', data => {
            if (event_bus !== null) {
                event_bus.emit('stdout', data);
            } else if (stdout_size + data.length > this.runtime.output_max_size) {
                message = 'stdout length exceeded';
                status = 'OL';
                this.logger.info(message);
                try {
                    process.kill(proc.pid, 'SIGABRT');
                } catch (e) {
                    if (IS_DEBUG) this.logger.debug(`Got error while SIGABRTing process ${proc}:`, e);
                }
            } else {
                stdout_size += data.length;
                stdout_chunks.push(data);
                output_chunks.push(data);
            }
        });

        const data = await new Promise((res, rej) => {
            proc.on('exit', (_, signal) => {
                res({ signal });
            });
            proc.on('error', err => {
                rej({ error: err });
            });
        });

        const wall_end = process.hrtime.bigint();
        const real_time = Math.round(Number(wall_end - wall_start) / 1_000_000);

        const stdout = Buffer.concat(stdout_chunks).toString();
        const stderr = Buffer.concat(stderr_chunks).toString();
        const output = Buffer.concat(output_chunks).toString();

        try {
            const metadata_str = (await fs.readFile(box.metadata_file_path)).toString();
            const metadata_lines = metadata_str.split('\n');
            for (const line of metadata_lines) {
                if (!line) continue;
                const sep = line.indexOf(':');
                if (sep === -1) {
                    throw new Error(`Failed to parse metadata file, received: ${line}`);
                }
                const key = line.slice(0, sep).trim();
                const value = line.slice(sep + 1).trim();
                switch (key) {
                    case 'cg-mem':
                        memory = parseInt(value) * 1000;
                        break;
                    case 'max-rss':
                        memory = memory ?? parseInt(value) * 1024;
                        break;
                    case 'exitcode':
                        code = parseInt(value);
                        break;
                    case 'exitsig':
                        signal = globals.SIGNALS[parseInt(value)] ?? null;
                        break;
                    case 'message':
                        message = message || value;
                        break;
                    case 'status':
                        status = status || value;
                        break;
                    case 'time':
                        cpu_time_stat = parseFloat(value) * 1000;
                        break;
                    case 'time-wall':
                        wall_time_stat = parseFloat(value) * 1000;
                        break;
                    default:
                        break;
                }
            }
        } catch (e) {
            throw new Error(
                `Error reading metadata file: ${box.metadata_file_path}\nError: ${e.message}\nIsolate run stdout: ${stdout}\nIsolate run stderr: ${stderr}`
            );
        }

        const baseline = runtime_baselines.get(this.runtime.language) ?? 0;
        const code_memory = memory !== null ? Math.max(0, memory - baseline) : null;

        return {
            ...data,
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
            this.files.filter(file => file.encoding == 'utf8');

        let compile;
        let compile_errored = false;
        const { emit_event_bus_result, emit_event_bus_stage } =
            event_bus === null
                ? { emit_event_bus_result: () => {}, emit_event_bus_stage: () => {} }
                : {
                      emit_event_bus_result: (stage, result) => {
                          const { error, code, signal } = result;
                          event_bus.emit('exit', stage, { error, code, signal });
                      },
                      emit_event_bus_stage: stage => {
                          event_bus.emit('stage', stage);
                      },
                  };

        if (this.runtime.compiled) {
            if (IS_DEBUG) this.logger.debug('Compiling');
            emit_event_bus_stage('compile');

            // Create the run box concurrently with compilation to hide isolate --init latency
            const next_box_promise = this.#create_isolate_box();

            compile = await this.safe_call(
                box,
                'compile',
                code_files.map(x => x.name),
                this.timeouts.compile,
                this.cpu_times.compile,
                this.memory_limits.compile,
                event_bus
            );
            emit_event_bus_result('compile', compile);
            compile_errored = compile.code !== 0 || compile.status !== null;

            if (!compile_errored) {
                const old_box_dir = box.dir;
                box = await next_box_promise;
                await fs.rename(
                    path.join(old_box_dir, 'submission'),
                    path.join(box.dir, 'submission')
                );
            } else {
                // Compilation failed — settle the promise so Node doesn't warn about
                // unhandled rejection; box (if created) is already in dirty_boxes
                await next_box_promise.catch(() => {});
            }
        }

        let run;
        if (!compile_errored) {
            if (IS_DEBUG) this.logger.debug('Running');
            emit_event_bus_stage('run');
            run = await this.safe_call(
                box,
                'run',
                [code_files[0].name, ...this.args],
                this.timeouts.run,
                this.cpu_times.run,
                this.memory_limits.run,
                event_bus
            );
            emit_event_bus_result('run', run);
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
        this.logger.info(`Cleaning up job`);
        remaining_job_spaces++;
        if (job_queue.length > 0) {
            job_queue.shift()();
        }
        await Promise.all(
            this.#dirty_boxes.map(async box => {
                cp.exec(
                    `isolate --cleanup --cg -b${box.id}`,
                    (error, stdout, stderr) => {
                        // Return the ID to the free pool only after cleanup completes,
                        // so the same ID is never re-initialised while still in use.
                        release_box_id(box.id);
                        if (error) {
                            this.logger.error(
                                `Failed to run isolate --cleanup: ${error.message} on box #${box.id}\nstdout: ${stdout}\nstderr: ${stderr}`
                            );
                        }
                    }
                );
                try {
                    await fs.rm(box.metadata_file_path);
                } catch (e) {
                    if (e.code !== 'ENOENT') {
                        this.logger.error(
                            `Failed to remove the metadata file of box #${box.id}. Error: ${e.message}`
                        );
                    }
                }
            })
        );
    }
}

module.exports = { Job };
