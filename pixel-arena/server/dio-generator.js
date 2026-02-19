// =============== DIO LINE GENERATION PIPELINE ===============
// Brave Search (trends) → Claude API (generation) → filter → DB store
import Anthropic from '@anthropic-ai/sdk'
import { DIO_SYSTEM_PROMPT, buildGenerationPrompt, filterLine, CATEGORIES } from './dio-prompts.js'
import { insertDioBatch, archiveExpiredBatches, archivePreviousBatches, getLatestActiveBatch } from './db.js'

var BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || ''
var ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''

// ---- Step 1: Discover trends via Brave Search ----

async function discoverTrends() {
  if (!BRAVE_API_KEY) {
    console.log('[Dio] No BRAVE_SEARCH_API_KEY — generating without trends')
    return []
  }

  var queries = [
    'trending meme this week 2026',
    'tiktok viral trend this week',
    'internet culture trending now',
    'popular gaming meme this week',
    'viral pop culture moment this week'
  ]

  var trends = []
  for (var query of queries) {
    try {
      var url = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(query) + '&count=3'
      var resp = await fetch(url, {
        headers: { 'X-Subscription-Token': BRAVE_API_KEY, 'Accept': 'application/json' }
      })
      if (!resp.ok) continue
      var data = await resp.json()
      var results = data.web?.results || []
      for (var r of results.slice(0, 3)) {
        var summary = (r.title + ' — ' + (r.description || '')).slice(0, 200)
        trends.push(summary)
      }
    } catch (err) {
      console.log('[Dio] Brave search failed for query:', query, err.message)
    }
  }

  // Deduplicate and cap at 15
  var unique = [...new Set(trends)].slice(0, 15)
  console.log('[Dio] Discovered', unique.length, 'trends')
  return unique
}

// ---- Step 2: Generate lines via Claude API ----

async function generateLines(trends) {
  if (!ANTHROPIC_KEY) {
    throw new Error('No ANTHROPIC_API_KEY configured')
  }

  var client = new Anthropic({ apiKey: ANTHROPIC_KEY })
  var userPrompt = buildGenerationPrompt(trends)

  console.log('[Dio] Calling Claude API...')
  var message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: DIO_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  })

  // Extract JSON from response
  var text = ''
  for (var block of message.content) {
    if (block.type === 'text') text += block.text
  }

  // Try to parse JSON — handle markdown code fences
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  var parsed = JSON.parse(text)
  return parsed.lines || []
}

// ---- Step 3: Filter ----

function filterLines(rawLines) {
  var filtered = rawLines.filter(filterLine)

  // Verify minimum per category
  var counts = {}
  for (var cat of CATEGORIES) counts[cat] = 0
  for (var line of filtered) counts[line.category]++

  var missing = CATEGORIES.filter(c => counts[c] < 3)
  if (missing.length > 0) {
    console.log('[Dio] Warning: low line count for categories:', missing.join(', '))
  }

  console.log('[Dio] Filtered:', rawLines.length, '→', filtered.length, 'lines')
  return filtered
}

// ---- Step 4: Store in DB ----

function storeLines(trends, lines) {
  // Archive any expired batches first
  archiveExpiredBatches()

  // Expires in 14 days
  var expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '')
  var trendsJson = JSON.stringify(trends)
  var batchId = insertDioBatch(trendsJson, expires, lines)

  console.log('[Dio] Stored batch', batchId, 'with', lines.length, 'lines, expires', expires)
  return batchId
}

// ---- Main pipeline ----

export async function generateDioBatch() {
  console.log('[Dio] Starting generation pipeline...')
  var trends = await discoverTrends()
  var rawLines = await generateLines(trends)
  var filtered = filterLines(rawLines)

  if (filtered.length < 15) {
    console.log('[Dio] Too few lines passed filter (' + filtered.length + '), aborting batch')
    return null
  }

  var batchId = storeLines(trends, filtered)

  // Archive all previous batches — only the fresh batch stays active
  archivePreviousBatches(batchId)
  console.log('[Dio] Archived previous batches — only batch', batchId, 'is now active')

  console.log('[Dio] Generation complete — batch', batchId)
  return batchId
}

export function isDioEnabled() {
  return !!ANTHROPIC_KEY
}

export function isStale(batch) {
  if (!batch) return true
  var generated = new Date(batch.generated_at + 'Z')
  var age = Date.now() - generated.getTime()
  var interval = parseInt(process.env.DIO_GENERATION_INTERVAL_MS) || 604800000
  return age > interval
}
