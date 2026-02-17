// =============== SOME OF YOU MAY DIE — EXPRESS API ===============
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDB, initTransactions } from './db.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import saveRoutes from './routes/saves.js';
import adminRoutes, { adminPage } from './routes/admin.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var PORT = process.env.PORT || 3001;

// Initialize database
initDB();
initTransactions();

var app = express();

// Compression (critical for .wasm files — ~60-70% reduction)
app.use(compression());

// CORS — needed for Squarespace website → Railway API calls
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Player-Id', 'X-Admin-Key']
}));

// Body parsing with size limit
app.use(express.json({ limit: '1mb' }));

// ---- COOP/COEP headers for Godot web export ----
var gamePath = path.join(__dirname, '..', 'public', 'game');
if (fs.existsSync(gamePath)) {
  app.use('/game', function (req, res, next) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  }, express.static(gamePath));
}

// ---- Static files (production dist or public) ----
var distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

var publicPath = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// ---- Debug: check game files exist ----
app.get('/game-check', function (req, res) {
  var files = [];
  try { files = fs.readdirSync(gamePath); } catch (e) { /* ignore */ }
  res.json({
    gamePath: gamePath,
    exists: fs.existsSync(gamePath),
    files: files,
    distExists: fs.existsSync(distPath),
    cwd: process.cwd()
  });
});

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/saves', saveRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.get('/admin', adminPage);

// SPA fallback (serve index.html for non-API, non-file routes)
if (fs.existsSync(distPath)) {
  app.get('*', function (req, res) {
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) return;
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, function () {
  console.log('Some of You May Die running on port ' + PORT);
});
