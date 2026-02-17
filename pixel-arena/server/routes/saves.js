// =============== CLOUD SAVE ROUTES ===============
import { Router } from 'express';
import { requireAuth } from './auth.js';
import { getSave, upsertSave, deleteSave } from '../db.js';

var router = Router();

var MAX_SAVE_SIZE = 512 * 1024; // 500KB

// GET /api/saves — download save data
router.get('/', requireAuth, function (req, res) {
  var save = getSave(req.userId);
  if (!save) return res.status(404).json({ error: 'No save data found' });
  res.json({ save: JSON.parse(save.save_json), updatedAt: save.updated_at });
});

// PUT /api/saves — upload save data
router.put('/', requireAuth, function (req, res) {
  var saveData = req.body.save;
  if (!saveData || typeof saveData !== 'object') {
    return res.status(400).json({ error: 'Missing save data' });
  }
  if (saveData.version !== 4) {
    return res.status(400).json({ error: 'Invalid save version (expected v4)' });
  }
  if (!Array.isArray(saveData.slots)) {
    return res.status(400).json({ error: 'Invalid save format: missing slots' });
  }

  var json = JSON.stringify(saveData);
  if (json.length > MAX_SAVE_SIZE) {
    return res.status(413).json({ error: 'Save data too large (max 500KB)' });
  }

  upsertSave(req.userId, json);
  res.json({ ok: true });
});

// DELETE /api/saves — delete save data
router.delete('/', requireAuth, function (req, res) {
  deleteSave(req.userId);
  res.json({ ok: true });
});

export default router;
