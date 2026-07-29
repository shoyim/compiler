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
const { router: billingRouter } = require('./billing');
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

    // 1024gb avval mavjud edi — bu deyarli cheksiz limit va so'rov tanasi orqali
    // xotira/diskni tugatish (DoS) imkonini berardi, hattoki auth tekshiruvidan oldin.
    app.use(express.json({ limit: '200mb' }));
    app.use(express.urlencoded({ limit: '200mb', extended: true }));

    app.use((err, req, res, next) => {
        if (err.type === 'entity.too.large') {
            return res.status(413).send({ message: 'Ma\'lumot hajmi juda katta!' });
        }
        // Stack trace mijozga yuborilmaydi — bu ichki fayl yo'llari va tuzilishini
        // fosh qilishi mumkin edi. Faqat serverda log qilinadi.
        logger.error('Request parsing error:', err.message);
        return res.status(400).send({ message: 'Noto\'g\'ri so\'rov' });
    });

    logger.debug('Registering Routes');
    const api_v2 = require('./api/v2');
    app.use('/api/v2', api_v2);
    app.use('/auth', authRouter);
    app.use('/billing', billingRouter);

    const { version } = require('../package.json');
    app.use('/app-assets', express.static(path.join(__dirname, 'web-dist')));

    app.get('/robots.txt', (req, res) => {
        res.type('text/plain').send(
            [
                'User-agent: *',
                'Allow: /$',
                'Allow: /login$',
                'Disallow: /',
                '',
                `Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`,
            ].join('\n')
        );
    });
    app.get('/sitemap.xml', (req, res) => {
        const base = `${req.protocol}://${req.get('host')}`;
        res.type('application/xml').send(
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            `  <url><loc>${base}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
            `  <url><loc>${base}/login</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n` +
            `</urlset>\n`
        );
    });

    const spaRoutes = ['/', '/login', '/dashboard', '/users', '/tokens', '/jobs', '/tester', '/api-docs'];
    for (const route of spaRoutes) {
        app.get(route, (req, res) => {
            return res.sendFile(path.join(__dirname, 'web-dist', 'index.html'));
        });
    }

    app.use((req, res, next) => {
        return res.status(404).send({ message: 'Not Found' });
    });

    async function cleanOldJobs() {
        try {
            const [result] = await db.getPool().execute(
                'DELETE FROM jobs WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
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