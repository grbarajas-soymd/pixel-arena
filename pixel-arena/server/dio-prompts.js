// =============== DIO PROMPTS — LOADS PERSONALITY FROM dio-personality.md ===============
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

var __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load personality from editable markdown file
var personalityPath = path.join(__dirname, 'dio-personality.md')
export var DIO_SYSTEM_PROMPT = fs.readFileSync(personalityPath, 'utf-8')

export var CATEGORIES = ['perfect_gear', 'trash_gear', 'death', 'victory', 'boss_kill']

export var LINES_PER_CATEGORY = 10

export function buildGenerationPrompt(trends) {
  var trendSection = ''
  if (trends && trends.length > 0) {
    trendSection = `\n\nCURRENT TRENDS TO REFERENCE (weave in subtly — don't force it, skip any that don't fit):\n`
    for (var t of trends) {
      trendSection += `- ${t}\n`
    }
    trendSection += `\nNot every line needs a trend reference. Maybe 30-40% can riff on trends, the rest should be timeless sardonic Dio.`
  }

  return `Generate ${LINES_PER_CATEGORY} fresh voice lines for each of these 5 categories: ${CATEGORIES.join(', ')}.

Rules:
- Each line MUST be 120 characters or fewer
- Lines must match the tone described in your personality for each category
- No repeating the example lines from your personality description
- Each line should feel like a unique quip, not a variation of another
- If referencing a trend, be subtle — Dio wouldn't say "that TikTok thing", he'd weave it into his fire-god persona${trendSection}

Respond with ONLY valid JSON in this exact format:
{
  "lines": [
    {"category": "perfect_gear", "text": "line here", "trend_ref": "trend name or null"},
    ...
  ]
}

Generate exactly ${LINES_PER_CATEGORY * CATEGORIES.length} lines total (${LINES_PER_CATEGORY} per category).`
}

// Content filter — reject lines that don't meet quality bar
var BLOCKLIST = [
  /\bf[uv]ck/i, /\bsh[i1]t/i, /\bass\b/i, /\bb[i1]tch/i,
  /\bn[i1]gg/i, /\bretard/i, /\bfag/i, /\bcunt/i,
  /\bkill\s+yourself/i, /\bsuicid/i, /\brape/i,
]

export function filterLine(line) {
  if (!line || typeof line.text !== 'string') return false
  var text = line.text.trim()
  if (text.length === 0 || text.length > 120) return false
  if (!CATEGORIES.includes(line.category)) return false
  for (var re of BLOCKLIST) {
    if (re.test(text)) return false
  }
  return true
}
