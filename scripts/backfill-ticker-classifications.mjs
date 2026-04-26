import pLimit from 'p-limit'
import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb.js'
import { normalizeTicker } from '../lib/instrument-reference/normalize.js'
import { massiveOverviewGet, massiveReferenceGet } from '../lib/instrument-reference/massiveClient.js'
import InstrumentReference from '../models/InstrumentReference.js'
import TickerOverview from '../models/TickerOverview.js'

const OVERVIEW_CONCURRENCY = 2
const MARKET_CONCURRENCY = 5
const OVERVIEW_RATE_LIMIT_MS = 220

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function safeTicker(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Skip option contract symbols; they are not reference tickers.
  if (trimmed.includes(' ')) return null
  try {
    return normalizeTicker(trimmed)
  } catch {
    return null
  }
}

async function collectTickers(db) {
  const collections = await db.listCollections().toArray()
  const collNames = new Set(collections.map((c) => c.name))

  const sources = [
    ['snaptradeaccountholdings', 'symbol'],
    ['snaptradeaccountpositionsv2', 'symbolTicker'],
    ['equitiesweighttimeseries', 'symbol'],
    ['pricehistories', 'symbol'],
  ].filter(([name]) => collNames.has(name))

  const raw = []
  for (const [name, field] of sources) {
    const values = await db.collection(name).distinct(field, {})
    raw.push(...values)
  }

  const set = new Set()
  for (const value of raw) {
    const normalized = safeTicker(value)
    if (normalized) set.add(normalized)
  }
  return [...set]
}

async function refreshMarketClassification(tickers) {
  const limit = pLimit(MARKET_CONCURRENCY)
  const stats = { classified: 0, unknown: 0, errors: 0 }

  await Promise.all(
    tickers.map((ticker) =>
      limit(async () => {
        const now = new Date()
        try {
          const { status, body, requestId, networkError } = await massiveReferenceGet(ticker)
          const base = {
            tickerUpper: ticker,
            lastCheckedAt: now,
            lastHttpStatus: status,
            lastRequestId: requestId,
          }

          if (networkError || status !== 200 || body?.status !== 'OK' || !Array.isArray(body?.results)) {
            stats.errors += 1
            await InstrumentReference.findOneAndUpdate(
              { tickerUpper: ticker },
              {
                $set: {
                  ...base,
                  lastError: networkError || `HTTP ${status}`,
                },
              },
              { upsert: true, new: true }
            )
            return
          }

          const results = body.results
          const exact = results.find((r) => String(r?.ticker || '').toUpperCase() === ticker)
          const chosen = exact || results[0] || null

          if (!chosen || !chosen.market) {
            stats.unknown += 1
            await InstrumentReference.findOneAndUpdate(
              { tickerUpper: ticker },
              {
                $set: {
                  ...base,
                  classificationOutcome: results.length === 0 ? 'confirmed_absent' : 'unresolved',
                  market: null,
                  massiveTicker: null,
                  active: null,
                  type: null,
                  locale: null,
                  primaryExchange: null,
                  name: null,
                  ambiguityCandidates: results.slice(0, 5).map((r) => r?.ticker).filter(Boolean),
                  lastSuccessAt: now,
                  lastError: null,
                },
              },
              { upsert: true, new: true }
            )
            return
          }

          stats.classified += 1
          await InstrumentReference.findOneAndUpdate(
            { tickerUpper: ticker },
            {
              $set: {
                ...base,
                classificationOutcome: 'classified',
                market: chosen.market,
                massiveTicker: chosen.ticker ?? null,
                active: typeof chosen.active === 'boolean' ? chosen.active : null,
                type: chosen.type ?? null,
                locale: chosen.locale ?? null,
                primaryExchange: chosen.primary_exchange ?? null,
                name: chosen.name ?? null,
                ambiguityCandidates: [],
                lastSuccessAt: now,
                lastError: null,
              },
            },
            { upsert: true, new: true }
          )
        } catch {
          stats.errors += 1
        }
      })
    )
  )

  return stats
}

function mapOverview(result) {
  return {
    name: result.name ?? null,
    description: result.description ?? null,
    type: result.type ?? null,
    market: result.market ?? null,
    locale: result.locale ?? null,
    active: typeof result.active === 'boolean' ? result.active : null,
    marketCap: result.market_cap ?? null,
    totalEmployees: result.total_employees ?? null,
    roundLot: result.round_lot ?? null,
    sicCode: result.sic_code ?? null,
    sicDescription: result.sic_description ?? null,
    homepageUrl: result.homepage_url ?? null,
    currencyName: result.currency_name ?? null,
    primaryExchange: result.primary_exchange ?? null,
    brandingIconUrl: result.branding?.icon_url ?? null,
    brandingLogoUrl: result.branding?.logo_url ?? null,
    address: result.address
      ? {
          address1: result.address.address1 ?? null,
          city: result.address.city ?? null,
          state: result.address.state ?? null,
          postalCode: result.address.postal_code ?? null,
        }
      : null,
    listDate: result.list_date ?? null,
    cik: result.cik ?? null,
    tickerRoot: result.ticker_root ?? null,
    tickerSuffix: result.ticker_suffix ?? null,
    shareClassSharesOutstanding: result.share_class_shares_outstanding ?? null,
    weightedSharesOutstanding: result.weighted_shares_outstanding ?? null,
    compositeFigi: result.composite_figi ?? null,
    shareClassFigi: result.share_class_figi ?? null,
  }
}

async function refreshTickerOverviews(tickers) {
  const limit = pLimit(OVERVIEW_CONCURRENCY)
  const stats = { fetched: 0, errors: 0 }

  await Promise.all(
    tickers.map((ticker) =>
      limit(async () => {
        await sleep(OVERVIEW_RATE_LIMIT_MS)
        const now = new Date()
        try {
          const { status, body, networkError } = await massiveOverviewGet(ticker)

          if (networkError || status !== 200) {
            stats.errors += 1
            await TickerOverview.findOneAndUpdate(
              { tickerUpper: ticker },
              {
                $set: {
                  tickerUpper: ticker,
                  lastCheckedAt: now,
                  lastHttpStatus: status,
                  lastError: networkError || `HTTP ${status}`,
                },
              },
              { upsert: true, new: true }
            )
            return
          }

          const result = body?.results
          if (!result || typeof result !== 'object' || Array.isArray(result)) {
            stats.errors += 1
            await TickerOverview.findOneAndUpdate(
              { tickerUpper: ticker },
              {
                $set: {
                  tickerUpper: ticker,
                  lastCheckedAt: now,
                  lastHttpStatus: status,
                  lastError: 'unexpected response shape',
                },
              },
              { upsert: true, new: true }
            )
            return
          }

          await TickerOverview.findOneAndUpdate(
            { tickerUpper: ticker },
            {
              $set: {
                tickerUpper: ticker,
                ...mapOverview(result),
                lastCheckedAt: now,
                lastSuccessAt: now,
                lastHttpStatus: status,
                lastError: null,
              },
            },
            { upsert: true, new: true }
          )
          stats.fetched += 1
        } catch {
          stats.errors += 1
        }
      })
    )
  )

  return stats
}

async function main() {
  await connectDB()
  const db = mongoose.connection.db
  const tickers = await collectTickers(db)

  console.log(`Ticker universe: ${tickers.length}`)
  if (tickers.length === 0) {
    console.log('No tickers found; nothing to backfill.')
    return
  }

  const market = await refreshMarketClassification(tickers)
  const overview = await refreshTickerOverviews(tickers)

  console.log(
    JSON.stringify(
      {
        tickerCount: tickers.length,
        market,
        overview,
      },
      null,
      2
    )
  )
}

try {
  await main()
} finally {
  await mongoose.connection.close()
}
