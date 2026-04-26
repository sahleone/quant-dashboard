import { CRYPTO_SYMBOLS, isCryptoSymbol } from '@/utils/cryptoSymbols'

const MASSIVE_BASE = 'https://api.massive.com'
const API_KEY = process.env.MASSIVE_API_KEY?.trim()

if (!API_KEY) {
  console.warn(
    'Warning: MASSIVE_API_KEY is not set. Price fetching via Massive API will fail.'
  )
}

export { CRYPTO_SYMBOLS, isCryptoSymbol }

function normalizeSymbol(symbol) {
  const clean = symbol.replace(/\s+/g, '').toUpperCase()
  if (clean.startsWith('X:')) return clean
  const base = clean.replace(/-USD$/, '')
  if (CRYPTO_SYMBOLS.has(base)) {
    return `X:${base}USD`
  }
  return clean
}

function fmtDate(d) {
  return d.toISOString().split('T')[0]
}

async function fetchWithRetry(url, maxRetries = 3) {
  let lastErr = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(url)
      if (resp.status === 429) {
        lastErr = new Error(`Massive API 429 rate limited`)
        console.warn(`Massive API rate limited (attempt ${attempt + 1}/${maxRetries}), retrying...`)
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Massive API ${resp.status}: ${text.slice(0, 200)}`)
      }
      return await resp.json()
    } catch (err) {
      lastErr = err
      if (attempt === maxRetries - 1) throw err
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  throw lastErr || new Error(`Massive API: exhausted ${maxRetries} retries`)
}

export async function fetchHistoricalPrices(symbol, startDate, endDate) {
  if (!API_KEY) {
    return { prices: [], reason: 'api_key_missing' }
  }

  const ticker = normalizeSymbol(symbol)

  const url =
    `${MASSIVE_BASE}/v2/aggs/ticker/${encodeURIComponent(ticker)}` +
    `/range/1/day/${fmtDate(startDate)}/${fmtDate(endDate)}` +
    `?adjusted=true&sort=asc&limit=50000&apiKey=${API_KEY}`

  try {
    const data = await fetchWithRetry(url)
    if (!data || data.resultsCount === 0 || !data.results) {
      return { prices: [], reason: 'empty_results' }
    }
    const prices = data.results.map((bar) => ({
      date: new Date(bar.t),
      open: bar.o ?? null,
      high: bar.h ?? null,
      low: bar.l ?? null,
      close: bar.c ?? null,
      volume: bar.v ?? null,
    }))
    return { prices, reason: null }
  } catch (err) {
    return { prices: [], reason: `fetch_failed: ${err.message}` }
  }
}

export async function getLatestPrice(symbol) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  const { prices } = await fetchHistoricalPrices(symbol, start, end)
  if (prices.length === 0) return null
  return prices[prices.length - 1].close
}

export async function fetchMultipleSymbols(symbols, startDate, endDate, batchSize = 5) {
  const results = new Map()

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (sym) => {
        const { prices } = await fetchHistoricalPrices(sym, startDate, endDate)
        return [sym, prices]
      })
    )
    for (const [sym, prices] of batchResults) {
      results.set(sym, prices)
    }
    if (i + batchSize < symbols.length) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  return results
}

const massiveClient = { fetchHistoricalPrices, getLatestPrice, fetchMultipleSymbols, isCryptoSymbol, CRYPTO_SYMBOLS }
export default massiveClient
