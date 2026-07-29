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
            role       VARCHAR(16) NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    try { await pool.execute(`ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user'`); } catch (_) {}
    try { await pool.execute(`ALTER TABLE users ADD COLUMN plan_id INT DEFAULT NULL`); } catch (_) {}
    try { await pool.execute(`ALTER TABLE users ADD COLUMN plan_started_at DATETIME DEFAULT NULL`); } catch (_) {}
    try { await pool.execute(`ALTER TABLE users ADD COLUMN plan_expires_at DATETIME DEFAULT NULL`); } catch (_) {}

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
    // `token` now stores sha256(raw_token) (64 hex chars, fits the existing VARCHAR(64) PK)
    // instead of the raw bearer secret, so a DB dump alone can't be replayed as valid tokens.
    try { await pool.execute(`ALTER TABLE tokens ADD COLUMN token_preview VARCHAR(32)`); } catch (_) {}

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS plans (
            id                    INT AUTO_INCREMENT PRIMARY KEY,
            name                  VARCHAR(64) NOT NULL UNIQUE,
            price                 DECIMAL(12,2) NOT NULL DEFAULT 0,
            duration_days         INT NOT NULL DEFAULT 30,
            monthly_request_limit INT DEFAULT NULL,
            concurrent_limit      INT DEFAULT NULL,
            allowed_languages     TEXT DEFAULT NULL,
            created_at            DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS purchase_requests (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            username     VARCHAR(64) NOT NULL,
            plan_id      INT NOT NULL,
            status       VARCHAR(16) NOT NULL DEFAULT 'pending',
            requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            decided_at   DATETIME DEFAULT NULL,
            decided_by   VARCHAR(64) DEFAULT NULL,
            INDEX idx_username (username),
            INDEX idx_status (status)
        )
    `);

    const [plan_rows] = await pool.execute('SELECT COUNT(*) as c FROM plans');
    if (plan_rows[0].c === 0) {
        await pool.execute(
            `INSERT INTO plans (name, price, duration_days, monthly_request_limit, concurrent_limit, allowed_languages) VALUES
             ('Basic',   50000.00, 30, 1000,  1, NULL),
             ('Pro',    150000.00, 30, 10000, 3, NULL),
             ('Premium',400000.00, 30, NULL,  10, NULL)`
        );
        logger.info('Default tariflar yaratildi: Basic, Pro, Premium');
    }

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS jobs (
            id              VARCHAR(36) NOT NULL PRIMARY KEY,
            username        VARCHAR(64),
            language        VARCHAR(64) NOT NULL,
            version         VARCHAR(64) NOT NULL,
            code            MEDIUMTEXT,
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
    try { await pool.execute(`ALTER TABLE jobs ADD COLUMN code MEDIUMTEXT AFTER version`); } catch (_) {}

    // Default admin user (only if table is empty)
    const [rows] = await pool.execute('SELECT COUNT(*) as c FROM users');
    if (rows[0].c === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        await pool.execute(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            ['admin', hash, 'admin']
        );
        logger.info('Default user created: admin / admin123');
    } else {
        // Ensure the first user named 'admin' has admin role (migration)
        await pool.execute(
            `UPDATE users SET role = 'admin' WHERE username = 'admin' AND role = 'user'`
        );
    }

    logger.info('Database connected');
    return pool;
}

function getPool() {
    return pool;
}

module.exports = { connect, getPool };
