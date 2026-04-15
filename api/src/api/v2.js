const express = require('express');
const router = express.Router();
const events = require('events');
const runtime = require('../runtime');
const { Job } = require('../job');
const package = require('../package');
const globals = require('../globals');
const { stat } = require('fs');
const logger = require('logplease').create('api/v2');
const jwt = require('jsonwebtoken');
const { db } = require('./config');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Token topilmadi" });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret_key_123', (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Token yaroqsiz yoki muddati o'tgan" });
        }
        req.user = user;
        next();
    });
};

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

router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Ma'lumotlar to'liq emas" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
        
        res.status(201).json({ success: true, message: "Ro'yxatdan o'tdingiz" });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Email allaqachon mavjud" });
        }
        res.status(500).json({ error: "Server xatosi","json": err.message });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length === 0) {
            return res.status(401).json({ message: "Email yoki parol noto'g'ri" });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Email yoki parol noto'g'ri" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'secret_key_123',
            { expiresIn: '24h' }
        );

        res.json({ 
            token, 
            user: { id: user.id, email: user.email },
            message: "Xush kelibsiz!" 
        });
    } catch (err) {
        res.status(500).json({ error: "Serverda xatolik" });
    }
});

router.get('/history/recent', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const query = 'SELECT * FROM execution_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5';
        
        const [results] = await db.query(query, [userId]);
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: "Xatolik" });
    }
});

router.get('/settings/piston-url', authenticateToken, async (req, res) => {
    try {
        const [results] = await db.query('SELECT key_value FROM settings WHERE key_name = ?', ['piston_url']);
        res.json({ url: results[0]?.key_value || 'http://localhost:2000/api/v2' });
    } catch (err) {
        res.status(500).json({ error: "Xatolik" });
    }
});

router.post('/settings/piston-url', authenticateToken, async (req, res) => {
    const { url } = req.body;
    try {
        await db.query(
            'INSERT INTO settings (key_name, key_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE key_value = ?',
            ['piston_url', url, url]
        );
        res.json({ message: "Saqlandi" });
    } catch (err) {
        res.status(500).json({ error: "Xatolik" });
    }
});

router.post('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { language, version, code, stdin, args, stdout, stderr, exit_code, execution_time } = req.body;

        const query = `
            INSERT INTO execution_history 
            (user_id, language, version, source_code, stdin, args, stdout, stderr, exit_code, execution_time) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(query, [
            userId, 
            language, 
            version, 
            code, 
            stdin || '', 
            JSON.stringify(args || []), 
            stdout || '', 
            stderr || '', 
            exit_code || 0, 
            execution_time || 0
        ]);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Tarixni saqlashda xatolik" });
    }
});

router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const [results] = await db.query(
            'SELECT * FROM execution_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', 
            [userId]
        );
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: "Xatolik yuz berdi" });
    }
});

router.delete('/history/all', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        await db.query('DELETE FROM execution_history WHERE user_id = ?', [userId]);
        res.json({ success: true, message: "Barcha tarix tozalandi" });
    } catch (err) {
        res.status(500).json({ message: "Tozalashda xatolik" });
    }
});

router.delete('/history/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const [result] = await db.query(
            'DELETE FROM execution_history WHERE id = ? AND user_id = ?', 
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Ma'lumot topilmadi yoki sizga tegishli emas" });
        }

        res.json({ success: true, message: "O'chirildi" });
    } catch (err) {
        res.status(500).json({ message: "O'chirishda xatolik" });
    }
});

router.get('/api-tokens', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, name, token_prefix, scopes, last_used_at, expires_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC', 
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api-tokens', authenticateToken, async (req, res) => {
    try {
        const { name, token, scopes, expires_at } = req.body;
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        const prefix = token.slice(0, 12);

        await db.query(
            'INSERT INTO api_tokens (user_id, name, token_hash, token_prefix, scopes, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, name, hash, prefix, JSON.stringify(scopes), expires_at || null]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api-tokens/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM api_tokens WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.ws('/connect', async (ws, req) => {
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


router.post('/execute', async (req, res) => {
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

        return res.status(200).send(response);
    } catch (error) {
        logger.error(`Error executing job: ${job.uuid}:\n${error}`);
        return res.status(500).send();
    } finally {
        try {
            await job.cleanup();
        } catch (error) {
            logger.error(`Error cleaning up job: ${job.uuid}:\n${error}`);
            return res.status(500).send();
        }
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

router.get('/packages', async (req, res) => {
    logger.debug('Request to list packages');
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