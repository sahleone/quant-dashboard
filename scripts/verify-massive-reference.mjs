#!/usr/bin/env node
/**
 * Blocking gate: verify Massive/Polygon v3 reference tickers access.
 * Usage: node --env-file=.env.local scripts/verify-massive-reference.mjs
 */

const key = process.env.MASSIVE_API_KEY?.trim()

if (!key) {
  console.error('FAIL: MASSIVE_API_KEY not set')
  process.exit(1)
}

const base = (
  process.env.MASSIVE_REFERENCE_BASE_URL ||
  process.env.MASSIVE_API_BASE ||
  'https://api.massive.com'
)
  .trim()
  .replace(/\/$/, '')

const url = `${base}/v3/reference/tickers?ticker=AAPL&apiKey=${encodeURIComponent(key)}`

const res = await fetch(url)
const bodyText = await res.text()
let parsed
try {
  parsed = JSON.parse(bodyText)
} catch {
  console.error(`FAIL: HTTP ${res.status}, non-JSON body`)
  console.error(bodyText.slice(0, 500))
  process.exit(1)
}

if (res.status !== 200) {
  console.error(`FAIL: HTTP ${res.status}`)
  console.error(bodyText.slice(0, 500))
  process.exit(1)
}

const market = parsed?.results?.[0]?.market
if (market !== 'stocks') {
  console.error(`FAIL: expected market "stocks", got: ${market}`)
  console.error(JSON.stringify(parsed, null, 2))
  process.exit(1)
}

console.log('PASS: AAPL → stocks')
process.exit(0)
