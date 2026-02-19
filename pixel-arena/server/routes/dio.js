// =============== DIO ROUTES + SCHEDULER ===============
import { Router } from 'express'
import {
  getActiveDioLines, getLatestActiveBatch,
  listDioBatches, getDioBatchLines,
  updateDioBatchStatus, flagDioLine
} from '../db.js'
import { generateDioBatch, isDioEnabled, isStale } from '../dio-generator.js'
import { CATEGORIES } from '../dio-prompts.js'

var router = Router()

var ADMIN_KEY = process.env.ADMIN_KEY || 'admin'

function checkAdmin(req, res) {
  var key = req.headers['x-admin-key'] || req.query.key
  if (key !== ADMIN_KEY) {
    res.status(403).json({ error: 'Invalid admin key' })
    return false
  }
  return true
}

// ---- In-memory cache (5 min TTL) ----

var _cache = null
var _cacheTime = 0
var CACHE_TTL = 5 * 60 * 1000

function getCachedLines() {
  if (_cache && (Date.now() - _cacheTime) < CACHE_TTL) {
    return _cache
  }

  var rows = getActiveDioLines()
  var batch = getLatestActiveBatch()

  var grouped = {}
  for (var cat of CATEGORIES) grouped[cat] = []
  for (var row of rows) {
    if (grouped[row.category]) {
      grouped[row.category].push(row.line_text)
    }
  }

  _cache = {
    version: batch ? batch.id : 0,
    generated_at: batch ? batch.generated_at : null,
    lines: grouped
  }
  _cacheTime = Date.now()
  return _cache
}

function invalidateCache() {
  _cache = null
  _cacheTime = 0
}

// ---- Public endpoint (no auth) ----

// GET /api/dio/lines
router.get('/lines', function (req, res) {
  var data = getCachedLines()
  res.json(data)
})

// ---- Admin endpoints ----

// POST /api/dio/generate — force regeneration
router.post('/generate', async function (req, res) {
  if (!checkAdmin(req, res)) return
  if (!isDioEnabled()) {
    return res.status(400).json({ error: 'No ANTHROPIC_API_KEY configured' })
  }
  try {
    var batchId = await generateDioBatch()
    invalidateCache()
    res.json({ ok: true, batchId })
  } catch (err) {
    console.error('[Dio] Generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/dio/batches — list all batches
router.get('/batches', function (req, res) {
  if (!checkAdmin(req, res)) return
  var batches = listDioBatches()
  res.json({ batches })
})

// GET /api/dio/batches/:id — batch detail with lines
router.get('/batches/:id', function (req, res) {
  if (!checkAdmin(req, res)) return
  var lines = getDioBatchLines(parseInt(req.params.id))
  res.json({ lines })
})

// PUT /api/dio/batches/:id — update status
router.put('/batches/:id', function (req, res) {
  if (!checkAdmin(req, res)) return
  var status = req.body.status
  if (!['active', 'archived', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  updateDioBatchStatus(parseInt(req.params.id), status)
  invalidateCache()
  res.json({ ok: true })
})

// PUT /api/dio/lines/:id/flag — flag/unflag a line
router.put('/lines/:id/flag', function (req, res) {
  if (!checkAdmin(req, res)) return
  var flagged = req.body.flagged ? 1 : 0
  flagDioLine(parseInt(req.params.id), flagged)
  invalidateCache()
  res.json({ ok: true })
})

// ---- Scheduler ----

var DIO_INTERVAL = parseInt(process.env.DIO_GENERATION_INTERVAL_MS) || 604800000 // 7 days

export function startDioScheduler() {
  if (!isDioEnabled()) {
    console.log('[Dio] No ANTHROPIC_API_KEY — live lines disabled')
    return
  }
  console.log('[Dio] Scheduler enabled (interval: ' + Math.round(DIO_INTERVAL / 3600000) + 'h)')

  // Check if generation is overdue
  var latest = getLatestActiveBatch()
  if (!latest || isStale(latest)) {
    console.log('[Dio] Lines stale or missing — generating...')
    generateDioBatch().then(function () {
      invalidateCache()
    }).catch(function (err) {
      console.error('[Dio] Initial generation failed:', err.message)
    })
  } else {
    console.log('[Dio] Active batch found (id=' + latest.id + '), next gen in ' +
      Math.round((DIO_INTERVAL - (Date.now() - new Date(latest.generated_at + 'Z').getTime())) / 3600000) + 'h')
  }

  setInterval(function () {
    console.log('[Dio] Scheduled regeneration starting...')
    generateDioBatch().then(function () {
      invalidateCache()
    }).catch(function (err) {
      console.error('[Dio] Scheduled generation failed:', err.message)
    })
  }, DIO_INTERVAL)
}

export default router
