'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('./db');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ message: 'username va password kerak' });
    }
    try {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Login yoki parol noto\'g\'ri' });
        }
        const token = uuidv4().replace(/-/g, '');
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await pool.execute(
            'INSERT INTO tokens (token, username, expires_at) VALUES (?, ?, ?)',
            [token, username, expires]
        );
        return res.json({ token, username, expires_at: expires.toISOString() });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.post('/logout', async (req, res) => {
    const token = extractToken(req);
    try {
        if (token) await getPool().execute('DELETE FROM tokens WHERE token = ?', [token]);
    } catch (_) {}
    return res.json({ message: 'Chiqildi' });
});

router.get('/me', async (req, res) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'Token kerak' });
    try {
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT username, expires_at FROM tokens WHERE token = ? AND expires_at > NOW()',
            [token]
        );
        if (!rows[0]) return res.status(401).json({ message: 'Token yaroqsiz' });
        return res.json({ username: rows[0].username, expires_at: rows[0].expires_at });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.post('/users', requireAuth, async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ message: 'username va password kerak' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        await getPool().execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hash]
        );
        return res.json({ message: `${username} qo'shildi` });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Bu username allaqachon mavjud' });
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.get('/users', requireAuth, async (req, res) => {
    try {
        const [rows] = await getPool().execute(
            'SELECT id, username, created_at FROM users ORDER BY created_at DESC'
        );
        return res.json(rows);
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.put('/users/:username', requireAuth, async (req, res) => {
    const { username } = req.params;
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ message: 'Yangi parol kerak' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const [result] = await getPool().execute(
            'UPDATE users SET password = ? WHERE username = ?', [hash, username]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        return res.json({ message: `${username} paroli yangilandi` });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.delete('/users/:username', requireAuth, async (req, res) => {
    const { username } = req.params;
    if (username === req.authUser) {
        return res.status(400).json({ message: 'O\'zingizni o\'chira olmaysiz' });
    }
    try {
        await getPool().execute('DELETE FROM tokens WHERE username = ?', [username]);
        await getPool().execute('DELETE FROM users WHERE username = ?', [username]);
        return res.json({ message: `${username} o'chirildi` });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.get('/tokens', requireAuth, async (req, res) => {
    try {
        const [rows] = await getPool().execute(
            'SELECT token, username, label, created_at, expires_at FROM tokens WHERE expires_at > NOW() ORDER BY created_at DESC'
        );
        return res.json(rows);
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.post('/tokens', requireAuth, async (req, res) => {
    const { label, expires_days } = req.body || {};
    const days = Math.min(Math.max(parseInt(expires_days) || 30, 1), 365);
    const token = uuidv4().replace(/-/g, '');
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    try {
        await getPool().execute(
            'INSERT INTO tokens (token, username, label, expires_at) VALUES (?, ?, ?, ?)',
            [token, req.authUser, label || null, expires]
        );
        return res.json({ token, username: req.authUser, label: label || null, expires_at: expires.toISOString(), expires_days: days });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.delete('/tokens/:token', requireAuth, async (req, res) => {
    try {
        await getPool().execute('DELETE FROM tokens WHERE token = ?', [req.params.token]);
        return res.json({ message: 'Token o\'chirildi' });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.put('/profile', requireAuth, async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
        return res.status(400).json({ message: 'Joriy va yangi parol kerak' });
    }
    if (new_password.length < 4) {
        return res.status(400).json({ message: 'Yangi parol kamida 4 ta belgi bo\'lishi kerak' });
    }
    try {
        const pool = getPool();
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [req.authUser]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(current_password, user.password))) {
            return res.status(401).json({ message: 'Joriy parol noto\'g\'ri' });
        }
        const hash = await bcrypt.hash(new_password, 10);
        await pool.execute('UPDATE users SET password = ? WHERE username = ?', [hash, req.authUser]);
        return res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi' });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

function extractToken(req) {
    const auth = req.headers['authorization'] || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
    return req.headers['x-auth-token'] || null;
}

async function requireAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'Token kerak' });
    try {
        const [rows] = await getPool().execute(
            'SELECT username FROM tokens WHERE token = ? AND expires_at > NOW()',
            [token]
        );
        if (!rows[0]) return res.status(401).json({ message: 'Token yaroqsiz yoki muddati tugagan' });
        req.authUser = rows[0].username;
        next();
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi' });
    }
}

module.exports = { router, requireAuth, extractToken };
