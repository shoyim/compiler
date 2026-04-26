'use strict';
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const logger = require('logplease').create('db');

let pool = null;

async function connect() {
    pool = mysql.createPool({
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '3306'),
        database: process.env.DB_NAME     || 'compiler',
        user:     process.env.DB_USER     || 'compiler',
        password: process.env.DB_PASSWORD || 'compiler_pass',
        waitForConnections: true,
        connectionLimit: 20,
    });

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            username   VARCHAR(64) NOT NULL UNIQUE,
            password   VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS tokens (
            token      VARCHAR(64) NOT NULL PRIMARY KEY,
            username   VARCHAR(64) NOT NULL,
            label      VARCHAR(128) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            INDEX idx_username (username)
        )
    `);

    try {
        await pool.execute(`ALTER TABLE tokens ADD COLUMN label VARCHAR(128) DEFAULT NULL`);
    } catch (_) {}

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS jobs (
            id              VARCHAR(36) NOT NULL PRIMARY KEY,
            username        VARCHAR(64),
            language        VARCHAR(64) NOT NULL,
            version         VARCHAR(64) NOT NULL,
            compile_exit    INT,
            compile_time    INT,
            compile_memory  INT,
            compile_stdout  TEXT,
            compile_stderr  TEXT,
            compile_status  VARCHAR(32),
            run_exit        INT,
            run_time        INT,
            run_memory      INT,
            run_stdout      TEXT,
            run_stderr      TEXT,
            run_status      VARCHAR(32),
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_created_at (created_at),
            INDEX idx_username   (username),
            INDEX idx_language   (language)
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    // Default admin user (only if table is empty)
    const [rows] = await pool.execute('SELECT COUNT(*) as c FROM users');
    if (rows[0].c === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await pool.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            ['admin', hash]
        );
        logger.info('Default user created: admin / admin123');
    }

    logger.info('Database connected');
    return pool;
}

function getPool() {
    return pool;
}

module.exports = { connect, getPool };
