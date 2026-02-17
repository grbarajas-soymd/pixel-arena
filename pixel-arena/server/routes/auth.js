// =============== AUTH ROUTES ===============
import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, getUserByUsername, getUserById } from '../db.js';

var router = Router();

var JWT_SECRET = process.env.JWT_SECRET || 'pixel-arena-dev-secret-change-me';
var JWT_EXPIRY = '30d';

// Middleware: verify JWT and attach req.userId
export function requireAuth(req, res, next) {
  var auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  try {
    var decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function makeToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// POST /api/auth/signup
router.post('/signup', function (req, res) {
  var username = (req.body.username || '').trim();
  var password = req.body.password || '';

  if (!username || username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Username must be 3-20 characters' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username: letters, numbers, underscores only' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  var existing = getUserByUsername(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  var id = crypto.randomUUID();
  var hash = bcrypt.hashSync(password, 10);
  createUser(id, username, hash);

  res.json({ token: makeToken(id), userId: id, username: username });
});

// POST /api/auth/login
router.post('/login', function (req, res) {
  var username = (req.body.username || '').trim();
  var password = req.body.password || '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  var user = getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  res.json({ token: makeToken(user.id), userId: user.id, username: user.username });
});

// GET /api/auth/me
router.get('/me', requireAuth, function (req, res) {
  var user = getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ userId: user.id, username: user.username, createdAt: user.created_at });
});

export default router;
