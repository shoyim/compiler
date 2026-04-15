#!/usr/bin/env node
require('nocamel');
const Logger = require('logplease');
const express = require('express');
const expressWs = require('express-ws');
const globals = require('./globals');
const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const body_parser = require('body-parser');
const runtime = require('./runtime');
const cors = require('cors');
const { db } = require('./api/config');
const { options, loadConfig, apply_validators } = require('./config');

let config = null;
let logger = null;

async function start() {
    config = await loadConfig(db);
    logger = Logger.create('index');
    logger.info('Setting loglevel to', config.log_level);
    Logger.setLogLevel(config.log_level);
    
    const app = express();
    expressWs(app);
    
    app.use(cors({
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }));
    
    app.use(express.json());
    
    logger.debug('Ensuring data directories exist');
    for (const dir of Object.values(globals.data_directories)) {
        let data_path = path.join(config.data_directory, dir);
        logger.debug(`Ensuring ${data_path} exists`);
        if (!fss.existsSync(data_path)) {
            logger.info(`${data_path} does not exist.. Creating..`);
            try {
                await fs.mkdir(data_path, { recursive: true });
            } catch (e) {
                logger.error(`Failed to create ${data_path}: `, e.message);
            }
        }
    }
    
    logger.info('Loading packages');
    const pkgdir = path.join(config.data_directory, globals.data_directories.packages);
    let pkglist = [];
    try {
        pkglist = await fs.readdir(pkgdir);
    } catch (err) {
        logger.warn(`Packages directory not found: ${pkgdir}, creating empty`);
        await fs.mkdir(pkgdir, { recursive: true });
    }
    const languages = await Promise.all(
        pkglist.map(lang => {
            return fs.readdir(path.join(pkgdir, lang)).then(x => {
                return x.map(y => path.join(pkgdir, lang, y));
            }).catch(() => []);
        })
    );
    const installed_languages = languages
        .flat()
        .filter(pkg => fss.existsSync(path.join(pkg, globals.pkg_installed_file)));
    
    installed_languages.forEach(pkg => runtime.load_package(pkg));
    
    logger.debug('Constructing Express App');
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
    
    const { version } = require('../package.json');
    app.get('/', (req, res) => {
        return res.status(200).send({ message: `Compiler v${version}` });
    });
    
    app.use((req, res) => {
        return res.status(404).send({ message: 'Not Found' });
    });
    
    const [address, port] = config.bind_address.split(':');
    const server = app.listen(parseInt(port, 10), address, () => {
        logger.info('API server started on', config.bind_address);
    });
    
    process.on('SIGTERM', () => {
        server.close();
        process.exit(0);
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});