const express = require('express');
const router = express.Router();
const events = require('events');
const runtime = require('../runtime');
const { Job } = require('../job');
const package = require('../package');
const globals = require('../globals');
const logger = require('logplease').create('api/v2');
const { requireAuth } = require('../auth');
const { getPool } = require('../db');
const fs = require('fs/promises');
const path = require('path');

// ── Comparator scripts ──────────────────────────────────────────────────────
// case_insensitive is the default (backward compat): exact first, then icase
const COMPARATORS = {
    case_insensitive: `\
ac = 0xAC
wa = 0xAD

a_in  = open("input.txt",   "r", encoding="utf-8").read()
a_out = open("answer.txt",  "r", encoding="utf-8").read()
u_out = open("user.txt",    "r", encoding="utf-8").read()
u_code= open("solution.txt","r", encoding="utf-8").read()

if a_out == u_out:
    exit(ac)
a = a_out.replace("\\r", "").split("\\n")
b = u_out.replace("\\r", "").split("\\n")
while a and a[-1] == "": a.pop()
while b and b[-1] == "": b.pop()
if len(a) != len(b):
    exit(wa)
for x, y in zip(a, b):
    if x.lower() != y.lower():
        exit(wa)
exit(ac)
`,
    default: `\
ac = 0xAC
wa = 0xAD

a_out = open("answer.txt", "r", encoding="utf-8").read()
u_out = open("user.txt",   "r", encoding="utf-8").read()

def norm(s):
    lines = s.replace("\\r", "").split("\\n")
    while lines and lines[-1].rstrip() == "": lines.pop()
    return "\\n".join(l.rstrip() for l in lines)

if norm(a_out) == norm(u_out):
    exit(ac)
exit(wa)
`,
    any_of: `\
ac = 0xAC
wa = 0xAD

a_out = open("answer.txt", "r", encoding="utf-8").read()
u_out = open("user.txt",   "r", encoding="utf-8").read().replace("\\r", "").rstrip()

for ans in a_out.split("\\n---\\n"):
    if ans.replace("\\r", "").rstrip() == u_out:
        exit(ac)
exit(wa)
`,
};

const DEFAULT_CHECKER = COMPARATORS.case_insensitive;

const CHECKER_VERDICTS = {
    172: 'AC',
    173: 'WA',
    174: 'PE',
    175: 'TL',
    176: 'ML',
};

// ── Validator script (static source-code analysis) ───────────────────────────
const VALIDATOR_SCRIPT = `\
import re, json, sys

ac, wa = 0xAC, 0xAD
solution = open("solution.txt", "r", encoding="utf-8").read()
cfg = json.load(open("validator_config.json", "r", encoding="utf-8"))

ban_kw = list(cfg.get("ban_keywords", []))
if cfg.get("ban_loops"):
    for kw in ["for", "while", "do", "goto"]:
        if kw not in ban_kw:
            ban_kw.append(kw)

for kw in ban_kw:
    if re.search(r"\\b" + re.escape(kw) + r"\\b", solution):
        sys.exit(wa)

max_chars = cfg.get("max_chars")
if max_chars and len(solution) > int(max_chars):
    sys.exit(wa)

max_lines = cfg.get("max_lines")
if max_lines and len(solution.split("\\n")) > int(max_lines):
    sys.exit(wa)

for op in cfg.get("ban_operators", []):
    if op in solution:
        sys.exit(wa)

for op in cfg.get("require_operators", []):
    if op not in solution:
        sys.exit(wa)

custom = cfg.get("custom_code", "")
if custom:
    exec(custom)

sys.exit(ac)
`;

// ── Interactive checker orchestrator ─────────────────────────────────────────
const INTERACTIVE_RUNNER = `\
import subprocess, sys, os, json

cfg = json.load(open("interactive_config.json", "r", encoding="utf-8"))
AC, WA, PE, TL, ML = 0xAC, 0xAD, 0xAE, 0xAF, 0xB0

if cfg.get("compiled"):
    binary = cfg["binary"]
    try:
        os.chmod(binary, 0o755)
    except Exception:
        pass
    run_cmd = ["./" + binary]
elif cfg.get("user_language") == "python":
    run_cmd = [sys.executable, cfg["source_file"]]
else:
    sys.exit(WA)

try:
    proc = subprocess.Popen(
        run_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        bufsize=1,
    )
except Exception:
    sys.exit(WA)

_g = {
    "__builtins__": __builtins__,
    "sys": sys, "os": os, "subprocess": subprocess,
    "proc": proc,
    "AC": AC, "WA": WA, "PE": PE, "TL": TL, "ML": ML,
    "input_data": open("input.txt", encoding="utf-8").read(),
    "answer_data": open("answer.txt", encoding="utf-8").read(),
}

checker_src = open("checker.py", encoding="utf-8").read()
try:
    exec(checker_src, _g)
    proc.kill()
    sys.exit(WA)
except SystemExit:
    try: proc.kill()
    except Exception: pass
    raise
except Exception:
    try: proc.kill()
    except Exception: pass
    sys.exit(WA)
`;

async function saveJob(uuid, username, result, code) {
    try {
        const c = result.compile;
        const r = result.run;
        await getPool().execute(
            `INSERT INTO jobs
             (id, username, language, version, code,
              compile_exit, compile_time, compile_memory, compile_stdout, compile_stderr, compile_status,
              run_exit, run_time, run_memory, run_stdout, run_stderr, run_status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                uuid, username || null, result.language, result.version,
                (code || '').slice(0, 65536),
                c?.code ?? null,
                c != null ? Math.round(c.real_time ?? c.wall_time ?? 0) : null,
                c?.memory ?? null,
                (c?.stdout || '').slice(0, 16384),
                (c?.stderr || '').slice(0, 16384),
                c?.status ?? null,
                r?.code ?? null,
                r != null ? Math.round(r.real_time ?? r.wall_time ?? 0) : null,
                r?.memory ?? null,
                (r?.stdout || '').slice(0, 16384),
                (r?.stderr || '').slice(0, 16384),
                r?.status ?? null,
            ]
        );
    } catch (e) {
        logger.warn('saveJob failed:', e.message);
    }
}

function format_time(ms) {
    if (ms === null || ms === undefined) return null;
    return `${Math.round(ms)}`;
}

function format_memory(bytes) {
    if (bytes === null || bytes === undefined) return null;
    return `${(bytes / 1024).toFixed(0)}`;
}

function format_output_size(str) {
    if (str === null || str === undefined) return null;
    const bytes = Buffer.byteLength(str, 'utf8');
    if (bytes < 1024) return `${bytes}`;
    return `${(bytes / 1024).toFixed(0)}`;
}

function format_stage(stage) {
    if (!stage) return undefined;
    return {
        stdout: stage.stdout,
        stderr: stage.stderr,
        output: stage.output,
        code: stage.code,
        signal: stage.signal,
        message: stage.message,
        status: stage.status,
        time: format_time(stage.real_time ?? stage.wall_time),
        cpu_time: stage.cpu_time,
        memory: format_memory(stage.memory),
        output_size: format_output_size(stage.output),
        
    };
}

function get_job(body) {
    let {
        language,
        version,
        args,
        stdin,
        files,
        compile_memory_limit,
        run_memory_limit,
        run_timeout,
        compile_timeout,
        run_cpu_time,
        compile_cpu_time,
    } = body;

    return new Promise((resolve, reject) => {
        if (!language || typeof language !== 'string') {
            return reject({ message: 'language is required as a string' });
        }
        if (!version || typeof version !== 'string') {
            return reject({ message: 'version is required as a string' });
        }
        if (!files || !Array.isArray(files)) {
            return reject({ message: 'files is required as an array' });
        }
        for (const [i, file] of files.entries()) {
            if (typeof file.content !== 'string') {
                return reject({ message: `files[${i}].content is required as a string` });
            }
        }

        const rt = runtime.get_latest_runtime_matching_language_version(language, version);
        if (rt === undefined) {
            return reject({ message: `${language}-${version} runtime is unknown` });
        }

        if (
            rt.language !== 'file' &&
            !files.some(file => !file.encoding || file.encoding === 'utf8')
        ) {
            return reject({ message: 'files must include at least one utf8 encoded file' });
        }

        for (const constraint of ['memory_limit', 'timeout', 'cpu_time']) {
            for (const type of ['compile', 'run']) {
                const constraint_name = `${type}_${constraint}`;
                const constraint_value = body[constraint_name];
                const configured_limit = rt[`${constraint}s`][type];
                if (!constraint_value) continue;
                if (typeof constraint_value !== 'number') {
                    return reject({ message: `If specified, ${constraint_name} must be a number` });
                }
                if (configured_limit <= 0) continue;
                if (constraint_value > configured_limit) {
                    return reject({
                        message: `${constraint_name} cannot exceed the configured limit of ${configured_limit}`,
                    });
                }
                if (constraint_value < 0) {
                    return reject({ message: `${constraint_name} must be non-negative` });
                }
            }
        }

        resolve(
            new Job({
                runtime: rt,
                args: args ?? [],
                stdin: stdin ?? '',
                files,
                timeouts: {
                    run: run_timeout ?? rt.timeouts.run,
                    compile: compile_timeout ?? rt.timeouts.compile,
                },
                cpu_times: {
                    run: run_cpu_time ?? rt.cpu_times.run,
                    compile: compile_cpu_time ?? rt.cpu_times.compile,
                },
                memory_limits: {
                    run: run_memory_limit ?? rt.memory_limits.run,
                    compile: compile_memory_limit ?? rt.memory_limits.compile,
                },
            })
        );
    });
}

router.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    if (!req.headers['content-type']?.startsWith('application/json')) {
        return res.status(415).send({ message: 'requests must be of type application/json' });
    }
    next();
});

router.ws('/connect', requireAuth, async (ws, req) => {
    let job = null;
    let event_bus = new events.EventEmitter();

    event_bus.on('stdout', data =>
        ws.send(JSON.stringify({ type: 'data', stream: 'stdout', data: data.toString() }))
    );
    event_bus.on('stderr', data =>
        ws.send(JSON.stringify({ type: 'data', stream: 'stderr', data: data.toString() }))
    );
    event_bus.on('stage', stage =>
        ws.send(JSON.stringify({ type: 'stage', stage }))
    );
    event_bus.on('exit', (stage, status) =>
        ws.send(JSON.stringify({ type: 'exit', stage, ...status }))
    );

    ws.on('message', async data => {
        try {
            const msg = JSON.parse(data);
            switch (msg.type) {
                case 'init':
                    if (job === null) {
                        job = await get_job(msg);
                        try {
                            const box = await job.prime();
                            ws.send(JSON.stringify({
                                type: 'runtime',
                                language: job.runtime.language,
                                version: job.runtime.version.raw,
                            }));
                            await job.execute(box, event_bus);
                        } catch (error) {
                            logger.error(`Error cleaning up job: ${job.uuid}:\n${error}`);
                            throw error;
                        } finally {
                            await job.cleanup();
                        }
                        ws.close(4999, 'Job Completed');
                    } else {
                        ws.close(4000, 'Already Initialized');
                    }
                    break;
                case 'data':
                    if (job !== null) {
                        if (msg.stream === 'stdin') {
                            event_bus.emit('stdin', msg.data);
                        } else {
                            ws.close(4004, 'Can only write to stdin');
                        }
                    } else {
                        ws.close(4003, 'Not yet initialized');
                    }
                    break;
                case 'signal':
                    if (job !== null) {
                        if (Object.values(globals.SIGNALS).includes(msg.signal)) {
                            event_bus.emit('signal', msg.signal);
                        } else {
                            ws.close(4005, 'Invalid signal');
                        }
                    } else {
                        ws.close(4003, 'Not yet initialized');
                    }
                    break;
            }
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
            ws.close(4002, 'Notified Error');
        }
    });

    setTimeout(() => {
        if (job === null) ws.close(4001, 'Initialization Timeout');
    }, 1000);
});

router.post('/execute/demo', async (req, res) => {
    let job;
    try {
        // Demo: timeout 5s, memory 64MB max
        const body = {
            ...req.body,
            run_timeout: Math.min(req.body.run_timeout || 5000, 5000),
            compile_timeout: Math.min(req.body.compile_timeout || 8000, 8000),
            run_memory_limit: Math.min(req.body.run_memory_limit || 67108864, 67108864),
        };
        job = await get_job(body);
    } catch (error) {
        return res.status(400).json(error);
    }
    try {
        const box = await job.prime();
        let result = await job.execute(box);

        if (result.run === undefined) {
            result.run = result.compile;
        }

        const response = {
            language: result.language,
            version: result.version,
            run: format_stage(result.run),
        };

        if (result.compile) {
            response.compile = format_stage(result.compile);
        }

        return res.status(200).send(response);
    } catch (error) {
        logger.error(`Error executing demo job: ${job.uuid}:\n${error}`);
        return res.status(500).send({ message: 'Demo job bajarishda xato: ' + error.message });
    } finally {
        job.cleanup().catch(error => {
            logger.error(`Error cleaning up demo job: ${job.uuid}:\n${error}`);
        });
    }
});

router.post('/execute', requireAuth, async (req, res) => {
    let job;
    try {
        job = await get_job(req.body);
    } catch (error) {
        return res.status(400).json(error);
    }
    try {
        const box = await job.prime();
        let result = await job.execute(box);

        if (result.run === undefined) {
            result.run = result.compile;
        }

        const response = {
            language: result.language,
            version: result.version,
            run: format_stage(result.run),
        };

        if (result.compile) {
            response.compile = format_stage(result.compile);
        }

        saveJob(job.uuid, req.authUser, result, req.body.files?.[0]?.content || '');
        return res.status(200).send(response);
    } catch (error) {
        logger.error(`Error executing job: ${job.uuid}:\n${error}`);
        return res.status(500).send({ message: 'Job bajarishda xato: ' + error.message });
    } finally {
        job.cleanup().catch(error => {
            logger.error(`Error cleaning up job: ${job.uuid}:\n${error}`);
        });
    }
});

function build_checker_code(comparator, custom_checker) {
    if (comparator === 'program') {
        return typeof custom_checker === 'string' ? custom_checker : DEFAULT_CHECKER;
    }
    return COMPARATORS[comparator] ?? DEFAULT_CHECKER;
}

async function run_checker(python_rt, { checker_code, input, expected_output, user_output, user_code }) {
    const job = new Job({
        runtime: python_rt,
        files: [
            { name: 'checker.py',   content: checker_code,    encoding: 'utf8' },
            { name: 'input.txt',    content: input,           encoding: 'utf8' },
            { name: 'answer.txt',   content: expected_output, encoding: 'utf8' },
            { name: 'user.txt',     content: user_output,     encoding: 'utf8' },
            { name: 'solution.txt', content: user_code,       encoding: 'utf8' },
        ],
        args: [],
        stdin: '',
        timeouts:      { run: python_rt.timeouts.run,      compile: python_rt.timeouts.compile },
        cpu_times:     { run: python_rt.cpu_times.run,     compile: python_rt.cpu_times.compile },
        memory_limits: { run: python_rt.memory_limits.run, compile: python_rt.memory_limits.compile },
    });
    try {
        const box = await job.prime();
        return await job.execute(box);
    } finally {
        job.cleanup().catch(() => {});
    }
}

async function run_validator(python_rt, { validator_config, solution_code }) {
    const job = new Job({
        runtime: python_rt,
        files: [
            { name: 'validator.py',          content: VALIDATOR_SCRIPT,              encoding: 'utf8' },
            { name: 'solution.txt',           content: solution_code,                encoding: 'utf8' },
            { name: 'validator_config.json',  content: JSON.stringify(validator_config), encoding: 'utf8' },
        ],
        args: [],
        stdin: '',
        timeouts:      { run: python_rt.timeouts.run,      compile: python_rt.timeouts.compile },
        cpu_times:     { run: python_rt.cpu_times.run,     compile: python_rt.cpu_times.compile },
        memory_limits: { run: python_rt.memory_limits.run, compile: python_rt.memory_limits.compile },
    });
    try {
        const box = await job.prime();
        return await job.execute(box);
    } finally {
        job.cleanup().catch(() => {});
    }
}

async function compile_for_interactive(user_rt, user_files) {
    if (!user_rt.compiled) return { compiled: false };

    const code_files = user_files.filter(f => !f.encoding || f.encoding === 'utf8');
    const compile_job = new Job({
        runtime: user_rt,
        files: user_files,
        args: [],
        stdin: '',
        timeouts:      { compile: user_rt.timeouts.compile,      run: 5000 },
        cpu_times:     { compile: user_rt.cpu_times.compile,     run: 5000 },
        memory_limits: { compile: user_rt.memory_limits.compile, run: -1 },
    });

    let box;
    try {
        box = await compile_job.prime();
        const compile_result = await compile_job.safe_call(
            box, 'compile',
            code_files.map(f => f.name),
            user_rt.timeouts.compile,
            user_rt.cpu_times.compile,
            user_rt.memory_limits.compile
        );

        if (compile_result.code !== 0 || compile_result.status) {
            return { compiled: true, compile_error: compile_result };
        }

        const submission_dir = path.join(box.dir, 'submission');
        const known_outputs = ['a.out', 'code.jar', 'binary'];
        for (const name of known_outputs) {
            try {
                const data = await fs.readFile(path.join(submission_dir, name));
                return { compiled: true, binary_name: name, binary_data: data.toString('base64'), compile_result };
            } catch (_) {}
        }
        return { compiled: true, compile_error: { code: 1, stderr: 'Binary not found', stdout: '', status: null } };
    } finally {
        compile_job.cleanup().catch(() => {});
    }
}

async function run_interactive_checker(python_rt, user_rt, { checker_code, input, answer, user_files }) {
    const is_python = user_rt.language === 'python';
    const config = { user_language: user_rt.language, compiled: false, binary: null, source_file: null };
    const extra_files = [];
    let compile_result_obj = null;

    if (user_rt.compiled) {
        const info = await compile_for_interactive(user_rt, user_files);
        if (info.compile_error) {
            return { compile: info.compile_error, run: undefined, language: user_rt.language, version: user_rt.version.raw };
        }
        config.compiled = true;
        config.binary = info.binary_name;
        compile_result_obj = info.compile_result;
        extra_files.push({ name: info.binary_name, content: info.binary_data, encoding: 'base64' });
    } else if (is_python) {
        const code_files = user_files.filter(f => !f.encoding || f.encoding === 'utf8');
        config.source_file = code_files[0]?.name || 'code.py';
        extra_files.push(...user_files);
    } else {
        return {
            compile: undefined,
            run: { code: 0xAD, stdout: '', stderr: 'Interactive mode is not supported for this language', status: null },
            language: user_rt.language,
            version: user_rt.version.raw,
        };
    }

    const checker_job = new Job({
        runtime: python_rt,
        files: [
            { name: 'interactive_runner.py',  content: INTERACTIVE_RUNNER,          encoding: 'utf8' },
            { name: 'checker.py',             content: checker_code,                encoding: 'utf8' },
            { name: 'input.txt',              content: input,                       encoding: 'utf8' },
            { name: 'answer.txt',             content: answer,                      encoding: 'utf8' },
            { name: 'interactive_config.json',content: JSON.stringify(config),       encoding: 'utf8' },
            ...extra_files,
        ],
        args: [],
        stdin: '',
        timeouts:      { run: python_rt.timeouts.run,      compile: 0 },
        cpu_times:     { run: python_rt.cpu_times.run,     compile: 0 },
        memory_limits: { run: python_rt.memory_limits.run, compile: -1 },
    });

    try {
        const box = await checker_job.prime();
        if (config.compiled && config.binary) {
            await fs.chmod(path.join(box.dir, 'submission', config.binary), 0o755).catch(() => {});
        }
        const result = await checker_job.execute(box);
        return { compile: compile_result_obj, run: result.run, language: user_rt.language, version: user_rt.version.raw };
    } finally {
        checker_job.cleanup().catch(() => {});
    }
}

function verdict_from_run(run) {
    if (!run) return 'XX';
    if (run.status === 'TO') return 'TL';
    if (run.status === 'OL' || run.status === 'EL') return 'OL';
    if (run.code !== 0 || run.status) return 'RE';
    return null;
}

async function do_check(req_body, auth_user, res) {
    const { checker, expected_output, checker_type = 'default', validator } = req_body;
    if (typeof expected_output !== 'string') {
        return res.status(400).json({ message: 'expected_output is required as a string' });
    }

    // Backward compat: if checker is a string and no comparator → 'program'
    const comparator = req_body.comparator ?? (typeof checker === 'string' ? 'program' : 'case_insensitive');

    const python_rt = runtime.get_latest_runtime_matching_language_version('python', '*');
    if (!python_rt) {
        return res.status(500).json({ message: 'Python runtime topilmadi — checker ishlay olmaydi' });
    }

    // ── Validator (static source analysis) ──────────────────────────────────
    if (validator && typeof validator === 'object') {
        const solution_code = req_body.files?.[0]?.content || '';
        let vres;
        try {
            vres = await run_validator(python_rt, { validator_config: validator, solution_code });
        } catch (error) {
            logger.error(`Validator xatosi: ${error.message}`);
            return res.status(500).json({ message: 'Validator xatosi: ' + error.message });
        }
        if ((vres.run?.code ?? null) !== 172) {
            return res.json({ language: req_body.language, version: req_body.version, verdict: 'WA', validator_failed: true });
        }
    }

    let job;
    try {
        job = await get_job(req_body);
    } catch (error) {
        return res.status(400).json(error);
    }

    const input_content = req_body.stdin || req_body.files?.find(f => f.name === 'input.txt')?.content || '';

    // ── Interactive mode ─────────────────────────────────────────────────────
    if (checker_type === 'interactive') {
        const checker_code = typeof checker === 'string' ? checker : DEFAULT_CHECKER;
        let ires;
        try {
            ires = await run_interactive_checker(python_rt, job.runtime, {
                checker_code,
                input: input_content,
                answer: expected_output,
                user_files: req_body.files || [],
            });
        } catch (error) {
            logger.error(`Interactive checker xatosi: ${error.message}`);
            return res.status(500).json({ message: 'Interactive checker xatosi: ' + error.message });
        }
        const checker_exit = ires.run?.code ?? null;
        const verdict = CHECKER_VERDICTS[checker_exit] ?? 'WA';
        return res.json({
            language: ires.language,
            version: ires.version,
            verdict,
            checker_exit,
            ...(ires.compile ? { compile: format_stage(ires.compile) } : {}),
            run: format_stage(ires.run),
        });
    }

    // ── Normal execution ─────────────────────────────────────────────────────
    let result;
    try {
        const box = await job.prime();
        result = await job.execute(box);
        if (result.run === undefined) result.run = result.compile;
    } catch (error) {
        logger.error(`Error executing check job: ${job.uuid}:\n${error}`);
        return res.status(500).json({ message: 'Job bajarishda xato: ' + error.message });
    } finally {
        job.cleanup().catch(e => logger.error(`Cleanup error: ${e.message}`));
    }

    const base = {
        language: result.language,
        version: result.version,
        ...(result.compile ? { compile: format_stage(result.compile) } : {}),
    };

    if (result.compile && (result.compile.code !== 0 || result.compile.status)) {
        return res.json({ ...base, verdict: 'CE' });
    }

    const early_verdict = verdict_from_run(result.run);
    if (early_verdict) {
        return res.json({ ...base, verdict: early_verdict, run: format_stage(result.run) });
    }

    const checker_code = build_checker_code(comparator, checker);
    let checker_result;
    try {
        checker_result = await run_checker(python_rt, {
            checker_code,
            input:           input_content,
            expected_output,
            user_output:     result.run?.stdout || '',
            user_code:       req_body.files?.[0]?.content || '',
        });
    } catch (error) {
        logger.error(`Checker xatosi (job ${job.uuid}): ${error.message}`);
        return res.status(500).json({ message: 'Checker xatosi: ' + error.message });
    }

    const checker_exit = checker_result.run?.code ?? null;
    const verdict = CHECKER_VERDICTS[checker_exit] ?? 'WA';

    if (auth_user) saveJob(job.uuid, auth_user, result, req_body.files?.[0]?.content || '');

    return res.json({
        ...base,
        verdict,
        run: format_stage(result.run),
        checker_exit,
    });
}

router.post('/check/demo', async (req, res) => {
    const body = {
        ...req.body,
        run_timeout:      Math.min(req.body.run_timeout      || 5000,     5000),
        compile_timeout:  Math.min(req.body.compile_timeout  || 8000,     8000),
        run_memory_limit: Math.min(req.body.run_memory_limit || 67108864, 67108864),
    };
    return do_check(body, null, res);
});

router.post('/check', requireAuth, async (req, res) => {
    return do_check(req.body, req.authUser, res);
});

router.get('/jobs', requireAuth, async (req, res) => {
    const limit  = Math.min(Math.max(parseInt(req.query.limit)  || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const lang = req.query.language || null;
    const params = [];
    let where = '';
    if (lang) { where = 'WHERE language = ? '; params.push(lang); }
    try {
        const [[countResult], [rows]] = await Promise.all([
            getPool().query(`SELECT COUNT(*) as total FROM jobs ${where}`, params),
            getPool().query(
                `SELECT id, username, language, version,
                        compile_exit, compile_time, compile_memory, compile_status,
                        run_exit, run_time, run_memory, run_status,
                        created_at
                 FROM jobs ${where}ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
                params
            ),
        ]);
        return res.json({ jobs: rows, total: countResult[0].total });
    } catch (e) {
        logger.error('GET /jobs error:', e.message);
        return res.status(500).json({ message: 'Joblarni olishda xato: ' + e.message });
    }
});

router.get('/jobs/:id', requireAuth, async (req, res) => {
    try {
        const [rows] = await getPool().execute('SELECT * FROM jobs WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ message: 'Job topilmadi' });
        return res.json(rows[0]);
    } catch (e) {
        logger.error('GET /jobs/:id error:', e.message);
        return res.status(500).json({ message: 'Job ma\'lumotini olishda xato: ' + e.message });
    }
});

router.delete('/jobs/:id', requireAuth, async (req, res) => {
    try {
        const [result] = await getPool().execute('DELETE FROM jobs WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Job topilmadi' });
        return res.json({ message: 'Job o\'chirildi' });
    } catch (e) {
        logger.error('DELETE /jobs/:id error:', e.message);
        return res.status(500).json({ message: 'Job o\'chirishda xato: ' + e.message });
    }
});

router.delete('/jobs', requireAuth, async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'ids massivi kerak' });
    }
    try {
        const placeholders = ids.map(() => '?').join(',');
        const [result] = await getPool().execute(
            `DELETE FROM jobs WHERE id IN (${placeholders})`, ids
        );
        return res.json({ message: `${result.affectedRows} ta job o'chirildi`, deleted: result.affectedRows });
    } catch (e) {
        logger.error('DELETE /jobs error:', e.message);
        return res.status(500).json({ message: 'Joblarni o\'chirishda xato: ' + e.message });
    }
});

router.get('/runtimes', (req, res) => {
    const runtimes = runtime.map(rt => ({
        language: rt.language,
        version: rt.version.raw,
        aliases: rt.aliases,
        runtime: rt.runtime,
    }));
    return res.status(200).send(runtimes);
});

router.get('/packages/index', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('text/plain');
    res.sendFile(require('path').join(__dirname, '..', 'packages_index'));
});

router.get('/packages', async (req, res) => {
    logger.debug('Request to list packages');
    res.set('Cache-Control', 'no-store');
    let packages = await package.get_package_list();
    packages = packages.map(pkg => ({
        language: pkg.language,
        language_version: pkg.version?.raw ?? "unknown",
        installed: pkg.installed,
    }));
    return res.status(200).send(packages);
});

router.post('/packages', async (req, res) => {
    logger.debug('Request to install package');
    const { language, version } = req.body;
    const pkg = await package.get_package(language, version);
    if (pkg == null) {
        return res.status(404).send({
            message: `Requested package ${language}-${version} does not exist`,
        });
    }
    try {
        const response = await pkg.install();
        return res.status(200).send(response);
    } catch (e) {
        logger.error(`Error while installing package ${pkg.language}-${pkg.version}:`, e.message);
        return res.status(500).send({ message: e.message });
    }
});

router.delete('/packages', async (req, res) => {
    logger.debug('Request to uninstall package');
    const { language, version } = req.body;
    const pkg = await package.get_package(language, version);
    if (pkg == null) {
        return res.status(404).send({
            message: `Requested package ${language}-${version} does not exist`,
        });
    }
    try {
        const response = await pkg.uninstall();
        return res.status(200).send(response);
    } catch (e) {
        logger.error(`Error while uninstalling package ${pkg.language}-${pkg.version}:`, e.message);
        return res.status(500).send({ message: e.message });
    }
});

module.exports = router;
