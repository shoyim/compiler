#!/usr/bin/env node
require('nocamel');
const Logger = require('logplease');
const express = require('express');
const expressWs = require('express-ws');
const globals = require('./globals');
const config = require('./config');
const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const body_parser = require('body-parser');
const runtime = require('./runtime');
const db = require('./db');
const { router: authRouter } = require('./auth');
const logger = Logger.create('index');
const app = express();
expressWs(app);

(async () => {
    logger.info('Setting loglevel to', config.log_level);
    Logger.setLogLevel(config.log_level);

    logger.info('Connecting to database');
    await db.connect();

    logger.debug('Ensuring data directories exist');
    Object.values(globals.data_directories).forEach(dir => {
        let data_path = path.join(config.data_directory, dir);
        logger.debug(`Ensuring ${data_path} exists`);
        if (!fss.existsSync(data_path)) {
            logger.info(`${data_path} does not exist.. Creating..`);
            try {
                fss.mkdirSync(data_path);
            } catch (e) {
                logger.error(`Failed to create ${data_path}: `, e.message);
            }
        }
    });

    logger.info('Loading packages');
    const pkgdir = path.join(config.data_directory, globals.data_directories.packages);
    const pkglist = await fs.readdir(pkgdir);
    const languages = await Promise.all(
        pkglist.map(lang => {
            return fs.readdir(path.join(pkgdir, lang)).then(x => {
                return x.map(y => path.join(pkgdir, lang, y));
            });
        })
    );
    const installed_languages = languages
        .flat()
        .filter(pkg => fss.existsSync(path.join(pkg, globals.pkg_installed_file)));

    installed_languages.forEach(pkg => runtime.load_package(pkg));

    logger.info('Starting API Server');
    logger.debug('Constructing Express App');
    logger.debug('Registering middleware');

    app.use(express.json({ limit: '1024gb' })); 
    app.use(express.urlencoded({ limit: '1024gb', extended: true }));

    app.use((err, req, res, next) => {
        if (err.type === 'entity.too.large') {
            return res.status(413).send({ message: 'Ma\'lumot hajmi juda katta!' });
        }
        return res.status(400).send({ stack: err.stack });
    });

    logger.debug('Registering Routes');
    const api_v2 = require('./api/v2');
    app.use('/api/v2', api_v2);
    app.use('/auth', authRouter);

    const { version } = require('../package.json');
    app.get('/dashboard', (req, res) => {
        return res.sendFile(path.join(__dirname, 'dashboard.html'));
    });
    app.get('/tokens', (req, res) => {
        return res.sendFile(path.join(__dirname, 'tokens.html'));
    });
    app.get('/jobs', (req, res) => {
        return res.sendFile(path.join(__dirname, 'jobs.html'));
    });
    app.get('/tester', (req, res) => {
        return res.sendFile(path.join(__dirname, 'tester.html'));
    });
    app.get('/api-docs', (req, res) => {
        return res.sendFile(path.join(__dirname, 'api-docs.html'));
    });
    app.get('/login', (req, res) => {
        return res.sendFile(path.join(__dirname, 'login.html'));
    });
    app.get('/', (req, res) => {
        return res.sendFile(path.join(__dirname, 'home.html'));
    });

    app.use((req, res, next) => {
        return res.status(404).send({ message: 'Not Found' });
    });

    async function cleanOldJobs() {
        try {
            const [result] = await db.getPool().execute(
                'DELETE FROM jobs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
            );
            logger.info(`Job cleanup: ${result.affectedRows} eski yozuv o'chirildi`);
        } catch (e) {
            logger.error('Job cleanup xatosi:', e.message);
        }
    }

    function scheduleMidnightCleanup() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0); // keyingi kun 00:00:00
        const msUntilMidnight = midnight - now;
        setTimeout(async () => {
            await cleanOldJobs();
            setInterval(cleanOldJobs, 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
        logger.info(`Job cleanup rejalashtirildi: ${Math.round(msUntilMidnight / 60000)} daqiqadan so'ng (00:00)`);
    }

    await cleanOldJobs();
    scheduleMidnightCleanup();

    logger.debug('Calling app.listen');
    const [address, port] = config.bind_address.split(':');
    const server = app.listen(port, address, () => {
        logger.info('API server started on', config.bind_address);
    });

    process.on('SIGTERM', () => {
        server.close();
        process.exit(0);
    });
})();