'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('./db');

const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ message: 'username va password kerak' });
    }

    const pool = getPool();
    const [rows] = await pool.execute(
        'SELECT * FROM users WHERE username = ?', [username]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Login yoki parol noto\'g\'ri' });
    }

    const token = uuidv4().replace(/-/g, '');
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 kun
    await pool.execute(
        'INSERT INTO tokens (token, username, expires_at) VALUES (?, ?, ?)',
        [token, username, expires]
    );

    return res.json({ token, username, expires_at: expires.toISOString() });
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
    const token = extractToken(req);
    if (token) {
        await getPool().execute('DELETE FROM tokens WHERE token = ?', [token]);
    }
    return res.json({ message: 'Chiqildi' });
});

// GET /auth/me
router.get('/me', async (req, res) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'Token kerak' });

    const pool = getPool();
    const [rows] = await pool.execute(
        'SELECT username, expires_at FROM tokens WHERE token = ? AND expires_at > NOW()',
        [token]
    );
    if (!rows[0]) return res.status(401).json({ message: 'Token yaroqsiz' });

    return res.json({ username: rows[0].username, expires_at: rows[0].expires_at });
});

// POST /auth/users  — yangi foydalanuvchi qo'shish (admin only check keyinroq qo'shiladi)
router.post('/users', requireAuth, async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ message: 'username va password kerak' });
    }
    const hash = await bcrypt.hash(password, 10);
    try {
        await getPool().execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hash]
        );
        return res.json({ message: `${username} qo'shildi` });
    } catch (e) {
        return res.status(409).json({ message: 'Bu username allaqachon mavjud' });
    }
});

// GET /auth/users
router.get('/users', requireAuth, async (req, res) => {
    const [rows] = await getPool().execute(
        'SELECT id, username, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json(rows);
});

// PUT /auth/users/:username — parol o'zgartirish
router.put('/users/:username', requireAuth, async (req, res) => {
    const { username } = req.params;
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ message: 'Yangi parol kerak' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await getPool().execute(
        'UPDATE users SET password = ? WHERE username = ?', [hash, username]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
    return res.json({ message: `${username} paroli yangilandi` });
});

// DELETE /auth/users/:username
router.delete('/users/:username', requireAuth, async (req, res) => {
    const { username } = req.params;
    if (username === req.authUser) {
        return res.status(400).json({ message: 'O\'zingizni o\'chira olmaysiz' });
    }
    await getPool().execute('DELETE FROM tokens WHERE username = ?', [username]);
    await getPool().execute('DELETE FROM users WHERE username = ?', [username]);
    return res.json({ message: `${username} o'chirildi` });
});

// GET /auth/tokens — faol tokenlar
router.get('/tokens', requireAuth, async (req, res) => {
    const [rows] = await getPool().execute(
        'SELECT token, username, created_at, expires_at FROM tokens WHERE expires_at > NOW() ORDER BY created_at DESC'
    );
    return res.json(rows);
});

// DELETE /auth/tokens/:token — tokenni o'chirish
router.delete('/tokens/:token', requireAuth, async (req, res) => {
    await getPool().execute('DELETE FROM tokens WHERE token = ?', [req.params.token]);
    return res.json({ message: 'Token o\'chirildi' });
});

function extractToken(req) {
    const auth = req.headers['authorization'] || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
    return req.headers['x-auth-token'] || null;
}

async function requireAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'Token kerak' });

    const [rows] = await getPool().execute(
        'SELECT username FROM tokens WHERE token = ? AND expires_at > NOW()',
        [token]
    );
    if (!rows[0]) return res.status(401).json({ message: 'Token yaroqsiz yoki muddati tugagan' });

    req.authUser = rows[0].username;
    next();
}

module.exports = { router, requireAuth, extractToken };
