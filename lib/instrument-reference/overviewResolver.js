import { connectDB } from '@/lib/mongodb'
import TickerOverview from '@/models/TickerOverview'
import { massiveCryptoOverviewGet, massiveOverviewGet } from '@/lib/instrument-reference/massiveClient.js'
import { isCryptoSymbol } from '@/utils/cryptoSymbols'
import {
  STALE_OVERVIEW_DAYS,
  STALE_OVERVIEW_ERROR_DAYS,
} from '@/lib/instrument-reference/constants.js'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function isOverviewStale(doc) {
  if (!doc || !doc.lastCheckedAt) return true
  const ageMs = Date.now() - new Date(doc.lastCheckedAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (doc.lastError) return ageDays >= STALE_OVERVIEW_ERROR_DAYS
  return ageDays >= STALE_OVERVIEW_DAYS
}

function mapOverviewResponse(r) {
  return {
    name: r.name ?? null,
    description: r.description ?? null,
    type: r.type ?? null,
    market: r.market ?? null,
    locale: r.locale ?? null,
    active: typeof r.active === 'boolean' ? r.active : null,
    marketCap: r.market_cap ?? null,
    totalEmployees: r.total_employees ?? null,
    roundLot: r.round_lot ?? null,
    sicCode: r.sic_code ?? null,
    sicDescription: r.sic_description ?? null,
    homepageUrl: r.homepage_url ?? null,
    currencyName: r.currency_name ?? null,
    primaryExchange: r.primary_exchange ?? null,
    brandingIconUrl: r.branding?.icon_url ?? null,
    brandingLogoUrl: r.branding?.logo_url ?? null,
    address: r.address
      ? {
          address1: r.address.address1 ?? null,
          city: r.address.city ?? null,
          state: r.address.state ?? null,
          postalCode: r.address.postal_code ?? null,
        }
      : null,
    listDate: r.list_date ?? null,
    cik: r.cik ?? null,
    tickerRoot: r.ticker_root ?? null,
    tickerSuffix: r.ticker_suffix ?? null,
    shareClassSharesOutstanding: r.share_class_shares_outstanding ?? null,
    weightedSharesOutstanding: r.weighted_shares_outstanding ?? null,
    compositeFigi: r.composite_figi ?? null,
    shareClassFigi: r.share_class_figi ?? null,
  }
}

export async function fetchTickerOverview(tickerUpper) {
  await connectDB()

  const existing = await TickerOverview.findOne({ tickerUpper })
  if (existing && !isOverviewStale(existing)) {
    return { status: 'hit', record: existing }
  }

  const now = new Date()
  let { status, body, networkError } = await massiveOverviewGet(tickerUpper)

  if (status === 404 && isCryptoSymbol(tickerUpper)) {
    const cryptoResult = await massiveCryptoOverviewGet(tickerUpper)
    status = cryptoResult.status
    body = cryptoResult.body
    networkError = cryptoResult.networkError
  }

  if (networkError || (status && status !== 200)) {
    const errorMsg = networkError || `HTTP ${status}`
    const doc = await TickerOverview.findOneAndUpdate(
      { tickerUpper },
      {
        $set: {
          tickerUpper,
          lastCheckedAt: now,
          lastHttpStatus: status,
          lastError: errorMsg,
        },
      },
      { upsert: true, new: true }
    )
    return { status: 'error', record: doc, error: errorMsg }
  }

  const results = body?.results
  if (!results || (typeof results !== 'object') || Array.isArray(results)) {
    const errorMsg = 'unexpected response shape'
    const doc = await TickerOverview.findOneAndUpdate(
      { tickerUpper },
      {
        $set: {
          tickerUpper,
          lastCheckedAt: now,
          lastHttpStatus: status,
          lastError: errorMsg,
        },
      },
      { upsert: true, new: true }
    )
    return { status: 'error', record: doc, error: errorMsg }
  }

  const mapped = mapOverviewResponse(results)
  const doc = await TickerOverview.findOneAndUpdate(
    { tickerUpper },
    {
      $set: {
        tickerUpper,
        ...mapped,
        lastCheckedAt: now,
        lastSuccessAt: now,
        lastHttpStatus: status,
        lastError: null,
      },
    },
    { upsert: true, new: true }
  )

  return { status: 'fetched', record: doc }
}

export async function fetchOverviewsBatch(tickers) {
  await connectDB()

  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))]

  const existing = await TickerOverview.find({ tickerUpper: { $in: unique } })
  const cacheMap = new Map(existing.map((doc) => [doc.tickerUpper, doc]))

  const needsFetch = unique.filter((t) => {
    const doc = cacheMap.get(t)
    return isOverviewStale(doc)
  })

  const stats = { fetched: 0, cached: unique.length - needsFetch.length, errors: 0 }

  for (const ticker of needsFetch) {
    await sleep(250)
    try {
      const result = await fetchTickerOverview(ticker)
      if (result.status === 'fetched') stats.fetched++
      else if (result.status === 'error') stats.errors++
      else stats.cached++
    } catch {
      stats.errors++
    }
  }

  return stats
}
