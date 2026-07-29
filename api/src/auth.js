'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('./db');

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Juda ko\'p urinish. Iltimos, keyinroq qayta urinib ko\'ring.' },
});

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function previewToken(token) {
    return token.slice(0, 12) + '...' + token.slice(-6);
}

// ── Public: Login ─────────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
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
            'INSERT INTO tokens (token, token_preview, username, expires_at) VALUES (?, ?, ?, ?)',
            [hashToken(token), previewToken(token), username, expires]
        );
        return res.json({ token, username, role: user.role, expires_at: expires.toISOString() });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

// ── Public: Register ──────────────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
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
    if (password.length < 8) {
        return res.status(400).json({ message: 'Parol kamida 8 ta belgi bo\'lishi kerak' });
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
        if (token) await getPool().execute('DELETE FROM tokens WHERE token = ?', [hashToken(token)]);
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
            [hashToken(token)]
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
// Faqat admin token yaratadi va apidan foydalanish ruxsatini beradi.
// Oddiy user faqat o'ziga (yoki, admin bo'lsa, istalgan userga) berilgan tokenlarni ko'ra oladi.
router.get('/tokens', requireAuth, async (req, res) => {
    const { username } = req.query;
    try {
        const cols = 'token as id, token_preview as preview, username, label, created_at, expires_at';
        let rows;
        if (req.authRole === 'admin') {
            [rows] = username
                ? await getPool().execute(
                      `SELECT ${cols} FROM tokens WHERE username = ? AND expires_at > NOW() ORDER BY created_at DESC`,
                      [username]
                  )
                : await getPool().execute(`SELECT ${cols} FROM tokens WHERE expires_at > NOW() ORDER BY created_at DESC`);
        } else {
            [rows] = await getPool().execute(
                `SELECT ${cols} FROM tokens WHERE username = ? AND expires_at > NOW() ORDER BY created_at DESC`,
                [req.authUser]
            );
        }
        return res.json(rows.map(r => ({ ...r, is_current: r.id === req.authTokenHash })));
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.post('/tokens', requireAuth, requireAdmin, async (req, res) => {
    const { username, label, expires_days } = req.body || {};
    if (!username) {
        return res.status(400).json({ message: 'username kerak' });
    }
    const days = Math.min(Math.max(parseInt(expires_days) || 30, 1), 365);
    const token = uuidv4().replace(/-/g, '');
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    try {
        const [urows] = await getPool().execute('SELECT username FROM users WHERE username = ?', [username]);
        if (!urows[0]) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        await getPool().execute(
            'INSERT INTO tokens (token, token_preview, username, label, expires_at) VALUES (?, ?, ?, ?, ?)',
            [hashToken(token), previewToken(token), username, label || null, expires]
        );
        return res.json({ token, username, label: label || null, expires_at: expires.toISOString(), expires_days: days });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.delete('/tokens/:id', requireAuth, async (req, res) => {
    try {
        const [result] = req.authRole === 'admin'
            ? await getPool().execute('DELETE FROM tokens WHERE token = ?', [req.params.id])
            : await getPool().execute(
                  'DELETE FROM tokens WHERE token = ? AND username = ?',
                  [req.params.id, req.authUser]
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
    if (new_password.length < 8) {
        return res.status(400).json({ message: 'Yangi parol kamida 8 ta belgi bo\'lishi kerak' });
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
    const tokenHash = hashToken(token);
    try {
        const [rows] = await getPool().execute(
            `SELECT t.username, u.role
             FROM tokens t
             JOIN users u ON t.username = u.username
             WHERE t.token = ? AND t.expires_at > NOW()`,
            [tokenHash]
        );
        if (!rows[0]) return res.status(401).json({ message: 'Token yaroqsiz yoki muddati tugagan' });
        req.authUser = rows[0].username;
        req.authRole = rows[0].role;
        req.authTokenHash = tokenHash;
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
