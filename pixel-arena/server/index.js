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
import dioRoutes, { startDioScheduler } from './routes/dio.js';
import { initDioTransaction } from './db.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var PORT = process.env.PORT || 3001;

// Initialize database
initDB();
initTransactions();
initDioTransaction();

var app = express();

// Compression (critical for .wasm files — ~60-70% reduction)
app.use(compression());

// CORS — needed for Squarespace website → Railway API calls
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key']
}));

// Body parsing with size limit
app.use(express.json({ limit: '1mb' }));

// ---- COOP/COEP headers for Godot web export (required for SharedArrayBuffer) ----
var gamePath = path.join(__dirname, '..', 'public', 'game');
app.use(function (req, res, next) {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/admin')) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
  next();
});

// Redirect /game to root for old links
app.get('/game', function (req, res) { res.redirect(301, '/'); });
app.get('/game/*', function (req, res) { res.redirect(301, req.path.replace('/game', '') || '/'); });

// ---- Godot export served at root ----
if (fs.existsSync(gamePath)) {
  app.use(express.static(gamePath));
}

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/saves', saveRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dio', dioRoutes);
app.use('/api/admin/dio', dioRoutes);
app.get('/admin', adminPage);

// Start Dio line scheduler
startDioScheduler();

// Fallback — serve Godot index.html for unmatched non-API routes
if (fs.existsSync(gamePath)) {
  app.get('*', function (req, res) {
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) return;
    res.sendFile(path.join(gamePath, 'index.html'));
  });
}

app.listen(PORT, function () {
  console.log('Some of You May Die running on port ' + PORT);
});
