'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('./db');

const router = express.Router();

// ── Public: Login ─────────────────────────────────────────────────────────────
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
        return res.json({ token, username, role: user.role, expires_at: expires.toISOString() });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

// ── Public: Register ──────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ message: 'username va password kerak' });
    }
    if (username.length < 3 || username.length > 64) {
        return res.status(400).json({ message: 'Username 3-64 ta belgi bo\'lishi kerak' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        return res.status(400).json({ message: 'Username faqat harf, raqam, _, ., - bo\'lishi mumkin' });
    }
    if (password.length < 4) {
        return res.status(400).json({ message: 'Parol kamida 4 ta belgi bo\'lishi kerak' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        await getPool().execute(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hash, 'user']
        );
        return res.status(201).json({ message: `${username} muvaffaqiyatli ro'yxatdan o'tdi` });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Bu username allaqachon mavjud' });
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
            `SELECT t.username, u.role, t.expires_at
             FROM tokens t
             JOIN users u ON t.username = u.username
             WHERE t.token = ? AND t.expires_at > NOW()`,
            [token]
        );
        if (!rows[0]) return res.status(401).json({ message: 'Token yaroqsiz' });
        return res.json({ username: rows[0].username, role: rows[0].role, expires_at: rows[0].expires_at });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

// ── Admin: User management ────────────────────────────────────────────────────
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
    const { username, password, role } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ message: 'username va password kerak' });
    }
    const user_role = role === 'admin' ? 'admin' : 'user';
    try {
        const hash = await bcrypt.hash(password, 10);
        await getPool().execute(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hash, user_role]
        );
        return res.json({ message: `${username} qo'shildi`, role: user_role });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Bu username allaqachon mavjud' });
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await getPool().execute(
            'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
        );
        return res.json(rows);
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.put('/users/:username', requireAuth, requireAdmin, async (req, res) => {
    const { username } = req.params;
    const { password, role } = req.body || {};
    if (!password && !role) return res.status(400).json({ message: 'Yangi parol yoki rol kerak' });
    try {
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            const [r1] = await getPool().execute(
                'UPDATE users SET password = ? WHERE username = ?', [hash, username]
            );
            if (r1.affectedRows === 0) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });
        }
        if (role && (role === 'admin' || role === 'user')) {
            await getPool().execute(
                'UPDATE users SET role = ? WHERE username = ?', [role, username]
            );
        }
        return res.json({ message: `${username} yangilandi` });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.delete('/users/:username', requireAuth, requireAdmin, async (req, res) => {
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

// ── Token management ──────────────────────────────────────────────────────────
router.get('/tokens', requireAuth, async (req, res) => {
    try {
        const [rows] = await getPool().execute(
            'SELECT token, username, label, created_at, expires_at FROM tokens WHERE username = ? AND expires_at > NOW() ORDER BY created_at DESC',
            [req.authUser]
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
        const [result] = await getPool().execute(
            'DELETE FROM tokens WHERE token = ? AND username = ?',
            [req.params.token, req.authUser]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Token topilmadi' });
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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
            `SELECT t.username, u.role
             FROM tokens t
             JOIN users u ON t.username = u.username
             WHERE t.token = ? AND t.expires_at > NOW()`,
            [token]
        );
        if (!rows[0]) return res.status(401).json({ message: 'Token yaroqsiz yoki muddati tugagan' });
        req.authUser = rows[0].username;
        req.authRole = rows[0].role;
        next();
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi' });
    }
}

function requireAdmin(req, res, next) {
    if (req.authRole !== 'admin') return res.status(403).json({ message: 'Admin huquqi kerak' });
    next();
}

module.exports = { router, requireAuth, requireAdmin, extractToken };
