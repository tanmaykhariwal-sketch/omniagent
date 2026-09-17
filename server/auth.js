const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');
const { normalizeEmail, isValidEmail, isValidPassword } = require('./validate');

const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid email address' });
    if (!isValidPassword(password)) return res.status(400).json({ error: 'password must be at least 8 characters' });

    const normalizedEmail = normalizeEmail(email);
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) return res.status(409).json({ error: 'email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(normalizedEmail, passwordHash, new Date().toISOString());

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'registration failed, try again' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const normalizedEmail = normalizeEmail(email);
    const db = getDb();
    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'invalid credentials' });

    req.session.userId = user.id;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'login failed, try again' });
  }
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

function requireAuth(req, res, next) {
  if (!req.session) return res.status(500).json({ error: 'session unavailable' });
  if (req.session.userId) return next();

  try {
    const db = getDb();
    const email = `anon-${crypto.randomUUID()}@omniagent.local`;
    const passwordHash = crypto.randomBytes(32).toString('hex');
    const result = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(email, passwordHash, new Date().toISOString());
    req.session.userId = Number(result.lastInsertRowid);
    next();
  } catch (err) {
    res.status(500).json({ error: 'could not start session' });
  }
}

module.exports = { authRouter, requireAuth };
