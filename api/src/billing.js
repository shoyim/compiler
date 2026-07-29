'use strict';
const express = require('express');
const { getPool } = require('./db');
const { requireAuth, requireAdmin } = require('./auth');

const router = express.Router();

function parseLanguages(raw) {
    if (!raw) return null;
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : null;
    } catch (_) {
        return null;
    }
}

function serializePlan(row) {
    return {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        duration_days: row.duration_days,
        monthly_request_limit: row.monthly_request_limit,
        concurrent_limit: row.concurrent_limit,
        allowed_languages: parseLanguages(row.allowed_languages),
        created_at: row.created_at,
    };
}

// ── Plans catalog ────────────────────────────────────────────────────────────
router.get('/plans', requireAuth, async (req, res) => {
    try {
        const [rows] = await getPool().execute('SELECT * FROM plans ORDER BY price ASC');
        return res.json(rows.map(serializePlan));
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.post('/plans', requireAuth, requireAdmin, async (req, res) => {
    const { name, price, duration_days, monthly_request_limit, concurrent_limit, allowed_languages } = req.body || {};
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'name kerak' });
    }
    try {
        const [result] = await getPool().execute(
            `INSERT INTO plans (name, price, duration_days, monthly_request_limit, concurrent_limit, allowed_languages)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                name,
                price ?? 0,
                duration_days ?? 30,
                monthly_request_limit ?? null,
                concurrent_limit ?? null,
                Array.isArray(allowed_languages) ? JSON.stringify(allowed_languages) : null,
            ]
        );
        const [rows] = await getPool().execute('SELECT * FROM plans WHERE id = ?', [result.insertId]);
        return res.status(201).json(serializePlan(rows[0]));
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Bu nomli tarif allaqachon mavjud' });
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.put('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
    const { name, price, duration_days, monthly_request_limit, concurrent_limit, allowed_languages } = req.body || {};
    try {
        const [rows] = await getPool().execute('SELECT * FROM plans WHERE id = ?', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ message: 'Tarif topilmadi' });
        const cur = rows[0];
        await getPool().execute(
            `UPDATE plans SET name=?, price=?, duration_days=?, monthly_request_limit=?, concurrent_limit=?, allowed_languages=? WHERE id=?`,
            [
                name ?? cur.name,
                price ?? cur.price,
                duration_days ?? cur.duration_days,
                monthly_request_limit === undefined ? cur.monthly_request_limit : monthly_request_limit,
                concurrent_limit === undefined ? cur.concurrent_limit : concurrent_limit,
                allowed_languages === undefined ? cur.allowed_languages : (Array.isArray(allowed_languages) ? JSON.stringify(allowed_languages) : null),
                req.params.id,
            ]
        );
        const [updated] = await getPool().execute('SELECT * FROM plans WHERE id = ?', [req.params.id]);
        return res.json(serializePlan(updated[0]));
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.delete('/plans/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [result] = await getPool().execute('DELETE FROM plans WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Tarif topilmadi' });
        await getPool().execute('UPDATE users SET plan_id=NULL, plan_started_at=NULL, plan_expires_at=NULL WHERE plan_id = ?', [req.params.id]);
        return res.json({ message: 'Tarif o\'chirildi' });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

// ── Current user's plan + usage ─────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
    try {
        const [urows] = await getPool().execute(
            `SELECT u.plan_id, u.plan_started_at, u.plan_expires_at, p.*
             FROM users u LEFT JOIN plans p ON u.plan_id = p.id
             WHERE u.username = ?`,
            [req.authUser]
        );
        const row = urows[0];
        if (!row || !row.plan_id) {
            return res.json({ plan: null, active: false, usage: null });
        }
        const active = new Date(row.plan_expires_at) > new Date();
        let used = null;
        if (row.monthly_request_limit !== null) {
            const [jrows] = await getPool().execute(
                'SELECT COUNT(*) as c FROM jobs WHERE username = ? AND created_at >= ?',
                [req.authUser, row.plan_started_at]
            );
            used = jrows[0].c;
        }
        return res.json({
            plan: serializePlan(row),
            active,
            started_at: row.plan_started_at,
            expires_at: row.plan_expires_at,
            usage: { used, limit: row.monthly_request_limit },
        });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

// ── Purchase flow (user requests, admin approves) ───────────────────────────
router.post('/plans/:id/purchase', requireAuth, async (req, res) => {
    try {
        const [prows] = await getPool().execute('SELECT id FROM plans WHERE id = ?', [req.params.id]);
        if (!prows[0]) return res.status(404).json({ message: 'Tarif topilmadi' });

        await getPool().execute(
            `UPDATE purchase_requests SET status='cancelled', decided_at=NOW() WHERE username=? AND status='pending'`,
            [req.authUser]
        );
        const [result] = await getPool().execute(
            'INSERT INTO purchase_requests (username, plan_id) VALUES (?, ?)',
            [req.authUser, req.params.id]
        );
        return res.status(201).json({ id: result.insertId, message: 'So\'rov yuborildi, admin tasdiqlashini kuting' });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.get('/purchases', requireAuth, requireAdmin, async (req, res) => {
    const { status } = req.query;
    try {
        const [rows] = status
            ? await getPool().execute(
                  `SELECT pr.*, p.name as plan_name, p.price as plan_price
                   FROM purchase_requests pr JOIN plans p ON pr.plan_id = p.id
                   WHERE pr.status = ? ORDER BY pr.requested_at DESC`,
                  [status]
              )
            : await getPool().execute(
                  `SELECT pr.*, p.name as plan_name, p.price as plan_price
                   FROM purchase_requests pr JOIN plans p ON pr.plan_id = p.id
                   ORDER BY pr.requested_at DESC`
              );
        return res.json(rows);
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.post('/purchases/:id/approve', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await getPool().execute(
            `SELECT pr.*, p.duration_days FROM purchase_requests pr JOIN plans p ON pr.plan_id = p.id WHERE pr.id = ?`,
            [req.params.id]
        );
        const reqRow = rows[0];
        if (!reqRow) return res.status(404).json({ message: 'So\'rov topilmadi' });
        if (reqRow.status !== 'pending') return res.status(400).json({ message: 'So\'rov allaqachon ko\'rib chiqilgan' });

        const expires = new Date(Date.now() + reqRow.duration_days * 24 * 60 * 60 * 1000);
        await getPool().execute(
            'UPDATE users SET plan_id=?, plan_started_at=NOW(), plan_expires_at=? WHERE username=?',
            [reqRow.plan_id, expires, reqRow.username]
        );
        await getPool().execute(
            `UPDATE purchase_requests SET status='approved', decided_at=NOW(), decided_by=? WHERE id=?`,
            [req.authUser, req.params.id]
        );
        return res.json({ message: `${reqRow.username} uchun tarif faollashtirildi`, expires_at: expires.toISOString() });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

router.post('/purchases/:id/reject', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [result] = await getPool().execute(
            `UPDATE purchase_requests SET status='rejected', decided_at=NOW(), decided_by=? WHERE id=? AND status='pending'`,
            [req.authUser, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'So\'rov topilmadi yoki allaqachon ko\'rib chiqilgan' });
        return res.json({ message: 'So\'rov rad etildi' });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

// ── Admin: direct plan assignment (bypasses purchase flow) ──────────────────
router.put('/users/:username/plan', requireAuth, requireAdmin, async (req, res) => {
    const { plan_id } = req.body || {};
    try {
        const [urows] = await getPool().execute('SELECT username FROM users WHERE username = ?', [req.params.username]);
        if (!urows[0]) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

        if (plan_id === null) {
            await getPool().execute(
                'UPDATE users SET plan_id=NULL, plan_started_at=NULL, plan_expires_at=NULL WHERE username=?',
                [req.params.username]
            );
            return res.json({ message: `${req.params.username} tarifi bekor qilindi` });
        }

        const [prows] = await getPool().execute('SELECT * FROM plans WHERE id = ?', [plan_id]);
        if (!prows[0]) return res.status(404).json({ message: 'Tarif topilmadi' });

        const expires = new Date(Date.now() + prows[0].duration_days * 24 * 60 * 60 * 1000);
        await getPool().execute(
            'UPDATE users SET plan_id=?, plan_started_at=NOW(), plan_expires_at=? WHERE username=?',
            [plan_id, expires, req.params.username]
        );
        return res.json({ message: `${req.params.username} uchun ${prows[0].name} tarifi biriktirildi`, expires_at: expires.toISOString() });
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
});

// ── Enforcement middleware for job-execution endpoints ───────────────────────
const active_jobs_by_user = new Map();

async function requirePlan(req, res, next) {
    if (req.authRole === 'admin') return next();
    try {
        const [urows] = await getPool().execute(
            `SELECT u.plan_id, u.plan_started_at, u.plan_expires_at, p.monthly_request_limit, p.concurrent_limit, p.allowed_languages
             FROM users u LEFT JOIN plans p ON u.plan_id = p.id
             WHERE u.username = ?`,
            [req.authUser]
        );
        const row = urows[0];
        if (!row || !row.plan_id || new Date(row.plan_expires_at) <= new Date()) {
            return res.status(402).json({ message: 'Faol tarifingiz yo\'q. Iltimos, tarif sotib oling.' });
        }

        const language = req.body?.language;
        const allowed = parseLanguages(row.allowed_languages);
        if (allowed && language && !allowed.includes(language)) {
            return res.status(403).json({ message: `Tarifingiz "${language}" tilini qo'llab-quvvatlamaydi` });
        }

        if (row.monthly_request_limit !== null) {
            const [jrows] = await getPool().execute(
                'SELECT COUNT(*) as c FROM jobs WHERE username = ? AND created_at >= ?',
                [req.authUser, row.plan_started_at]
            );
            if (jrows[0].c >= row.monthly_request_limit) {
                return res.status(429).json({ message: 'Oylik so\'rovlar limiti tugadi' });
            }
        }

        if (row.concurrent_limit !== null) {
            const current = active_jobs_by_user.get(req.authUser) || 0;
            if (current >= row.concurrent_limit) {
                return res.status(429).json({ message: 'Bir vaqtning o\'zida ruxsat etilgan so\'rovlar soni oshib ketdi' });
            }
            active_jobs_by_user.set(req.authUser, current + 1);
            res.on('finish', () => {
                const c = active_jobs_by_user.get(req.authUser) || 1;
                active_jobs_by_user.set(req.authUser, Math.max(0, c - 1));
            });
        }

        next();
    } catch (e) {
        return res.status(500).json({ message: 'Server xatosi: ' + e.message });
    }
}

module.exports = { router, requirePlan };
