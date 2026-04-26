#!/usr/bin/env node
/**
 * One-off smoke check for Massive REST (not flat files / S3).
 *
 *   node --env-file=.env.local scripts/run-massive-smoke.mjs
 *
 * Exits 0 on success, 1 on missing key or failed request.
 */

const key = process.env.MASSIVE_API_KEY?.trim()
if (!key) {
  console.error(
    'Missing MASSIVE_API_KEY. Example:\n  node --env-file=.env.local scripts/run-massive-smoke.mjs'
  )
  process.exit(1)
}

const fmt = (d) => d.toISOString().split('T')[0]
const end = new Date()
const start = new Date()
start.setDate(start.getDate() - 7)

const url =
  `https://api.massive.com/v2/aggs/ticker/AAPL/range/1/day/${fmt(start)}/${fmt(end)}` +
  '?adjusted=true&sort=asc&limit=500&apiKey=' +
  encodeURIComponent(key)

const res = await fetch(url)
const text = await res.text()
if (!res.ok) {
  console.error('Massive request failed', res.status, text.slice(0, 500))
  process.exit(1)
}

let data
try {
  data = JSON.parse(text)
} catch {
  console.error('Invalid JSON from Massive', text.slice(0, 200))
  process.exit(1)
}

const n = data.resultsCount ?? 0
const results = data.results ?? []
console.log('Massive smoke OK: status', res.status, 'resultsCount', n, 'parsed bars', results.length)
if (results.length === 0) {
  console.error('No bars returned for AAPL in range')
  process.exit(1)
}

const bar = results[0]
console.log('Sample bar keys:', Object.keys(bar).join(', '))
process.exit(0)
