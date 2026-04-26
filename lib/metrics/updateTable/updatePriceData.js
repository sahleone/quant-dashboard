import mongoose from 'mongoose'
import { fetchHistoricalPrices } from '@/utils/massiveClient'
import { isCryptoSymbol } from '@/utils/cryptoSymbols'
import { getCoverage } from '@/lib/prices/symbolCoverage'
import { resolveAll, routeByMarket } from '@/lib/instrument-reference/resolveAll.js'
import { fetchOverviewsBatch } from '@/lib/instrument-reference/overviewResolver.js'

async function getUniqueSymbols(opts = {}) {
  const db = mongoose.connection.db

  const query = {}
  if (opts.userId) query.userId = opts.userId
  if (opts.accountId) query.accountId = opts.accountId

  const collections = await db.listCollections().toArray()
  const collNames = new Set(collections.map((c) => c.name))

  const promises = []

  if (collNames.has('equitiesweighttimeseries')) {
    promises.push(db.collection('equitiesweighttimeseries').distinct('symbol', query))
  }

  if (collNames.has('snaptradeaccountactivities')) {
    promises.push(
      db.collection('snaptradeaccountactivities').distinct('symbol', {
        ...query,
        type: { $in: ['BUY', 'SELL', 'REI', 'OPTIONASSIGNMENT', 'OPTIONEXERCISE', 'OPTIONEXPIRATION'] },
      })
    )
  }

  if (collNames.has('snaptradeaccountpositions')) {
    promises.push(db.collection('snaptradeaccountpositions').distinct('symbol', query))
  }

  const results = await Promise.all(promises)
  const allSymbols = new Set(results.flat())
  return Array.from(allSymbols).filter((s) => s && s.trim().length > 0)
}

async function getSymbolDateRange(symbol, opts = {}) {
  const db = mongoose.connection.db

  const query = { symbol }
  const actQuery = { symbol }
  if (opts.userId) { query.userId = opts.userId; actQuery.userId = opts.userId }
  if (opts.accountId) { query.accountId = opts.accountId; actQuery.accountId = opts.accountId }

  const collections = await db.listCollections().toArray()
  const collNames = new Set(collections.map((c) => c.name))

  const promises = []

  if (collNames.has('equitiesweighttimeseries')) {
    promises.push(
      db.collection('equitiesweighttimeseries')
        .find(query, { projection: { date: 1 } })
        .sort({ date: 1 })
        .toArray()
    )
  }

  if (collNames.has('snaptradeaccountactivities')) {
    promises.push(
      db.collection('snaptradeaccountactivities')
        .find(actQuery, { projection: { trade_date: 1, date: 1 } })
        .sort({ trade_date: 1 })
        .toArray()
    )
  }

  const results = await Promise.all(promises)

  const allDates = []
  for (const docs of results) {
    for (const d of docs) {
      const dateVal = d.trade_date || d.date
      if (dateVal) allDates.push(new Date(dateVal))
    }
  }

  if (allDates.length === 0) return null

  allDates.sort((a, b) => a - b)
  const endDate = new Date()
  endDate.setHours(23, 59, 59, 999)

  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
  const startDate = allDates[0] < fiveYearsAgo ? fiveYearsAgo : allDates[0]

  return { startDate, endDate }
}

function isOptionSymbol(symbol) {
  return symbol.includes(' ') && symbol.trim() !== symbol.replace(/\s+/g, '')
}

async function processSymbol(symbol, opts = {}) {
  try {
    const dateRange = await getSymbolDateRange(symbol, opts)
    if (!dateRange) return { symbol, status: 'skipped', reason: 'no_positions', phase: 'skip' }

    if (isOptionSymbol(symbol)) {
      return await processOptionSymbol(symbol, dateRange)
    }

    const coverage = await getCoverage(symbol, dateRange.startDate, dateRange.endDate, {
      forceRefresh: opts.forceRefresh,
    })

    if (!coverage.needsRestTopUp) {
      return { symbol, status: 'skipped', reason: 'complete', phase: 'skip' }
    }

    if (coverage.restFrom && coverage.restTo) {
      return await processRestTopUp(symbol, coverage)
    }

    return { symbol, status: 'skipped', reason: 'no_action', phase: 'skip' }
  } catch (error) {
    return { symbol, status: 'error', reason: error.message || String(error), phase: 'error' }
  }
}

async function processOptionSymbol(symbol, dateRange) {
  const db = mongoose.connection.db
  const col = db.collection('pricehistories')

  const dates = []
  const current = new Date(dateRange.startDate)
  const end = new Date(dateRange.endDate)
  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  const existing = await col.find({ symbol }, { projection: { date: 1 } }).toArray()
  const existingSet = new Set(existing.map((p) => p.date.toISOString().split('T')[0]))

  const missing = dates.filter((d) => !existingSet.has(d.toISOString().split('T')[0]))
  if (missing.length === 0) return { symbol, status: 'skipped', reason: 'option_complete', phase: 'skip', isOption: true }

  const ops = missing.map((date) => ({
    updateOne: {
      filter: { symbol, date },
      update: {
        $set: { symbol, date, close: 0, open: 0, high: 0, low: 0, volume: 0 },
        $setOnInsert: { createdAt: new Date() },
      },
      upsert: true,
    },
  }))

  if (ops.length > 0) await col.bulkWrite(ops, { ordered: false })

  return { symbol, status: 'success', pricesFetched: 0, pricesStored: missing.length, isOption: true, phase: 'option' }
}

async function processRestTopUp(symbol, coverage) {
  const { restFrom, restTo } = coverage

  const { prices, reason } = await fetchHistoricalPrices(symbol, restFrom, restTo)
  if (prices.length === 0) {

    return {
      symbol,
      status: 'error',
      reason: reason || 'no_price_data',
      phase: 'rest',
    }
  }

  const db = mongoose.connection.db
  const col = db.collection('pricehistories')

  const ops = prices.map((price) => ({
    updateOne: {
      filter: { symbol, date: price.date },
      update: {
        $set: {
          symbol,
          date: price.date,
          close: price.close,
          open: price.open || null,
          high: price.high || null,
          low: price.low || null,
          volume: price.volume || null,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      upsert: true,
    },
  }))

  if (ops.length > 0) await col.bulkWrite(ops, { ordered: false })

  return {
    symbol,
    status: 'success',
    pricesFetched: prices.length,
    pricesStored: prices.length,
    isOption: false,
    isCrypto: isCryptoSymbol(symbol),
    phase: 'rest',
    restFrom: restFrom.toISOString().split('T')[0],
    restTo: restTo.toISOString().split('T')[0],
  }
}

export async function updatePriceData(opts = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected. Call connectDB() before running updatePriceData.')
  }

  const userId = opts.userId || null
  const accountId = opts.accountId || null
  const forceRefresh = opts.forceRefresh === true

  const t0 = Date.now()
  const summary = {
    totalSymbols: 0,
    processed: 0,
    skipped: 0,
    newPrices: 0,
    restCalls: 0,
    errors: [],
    instrumentSkipped: 0,
    instrumentUnsupported: 0,
  }

  try {
    const symbols = await getUniqueSymbols({ userId, accountId })
    summary.totalSymbols = symbols.length

    if (symbols.length === 0) {
      console.log('[price] no symbols found for this user')
      return summary
    }

    const optionSymbols = symbols.filter(isOptionSymbol)
    const nonOptionSymbols = symbols.filter((s) => !isOptionSymbol(s))

    let symbolsToProcess = symbols
    if (opts.skipInstrumentResolve !== true) {
      const resolveResults = await resolveAll(nonOptionSymbols)
      const routed = routeByMarket(resolveResults)
      summary.instrumentSkipped = routed.skipped.length
      summary.instrumentUnsupported = routed.unsupported.length

      const allowedRaw = new Set()
      for (let i = 0; i < nonOptionSymbols.length; i++) {
        const raw = nonOptionSymbols[i]
        const r = resolveResults[i]
        if (r.status !== 'unknown' && r.market && ['stocks', 'crypto'].includes(r.market)) {
          allowedRaw.add(raw)
        }
      }

      for (const raw of nonOptionSymbols) {
        if (isCryptoSymbol(raw)) allowedRaw.add(raw)
      }
      symbolsToProcess = [...optionSymbols, ...nonOptionSymbols.filter((s) => allowedRaw.has(s))]

      if (routed.equityTickers.length > 0) {
        try {
          const overviewResult = await fetchOverviewsBatch(routed.equityTickers)
          summary.overviewsFetched = overviewResult.fetched
          summary.overviewsCached = overviewResult.cached
          summary.overviewErrors = overviewResult.errors
          console.log('[price] overview batch complete:', overviewResult.fetched, 'fetched')
        } catch (err) {
          console.warn('[price] overview batch failed:', err.message)
        }
      }
    }

    console.log(`[price] starting pipeline — ${symbolsToProcess.length} symbols`)

    const BATCH_SIZE = opts.batchSize || 15

    for (let i = 0; i < symbolsToProcess.length; i += BATCH_SIZE) {
      const batch = symbolsToProcess.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const result = await processSymbol(symbol, {
              userId,
              accountId,
              forceRefresh,
            })
            return { symbol, result }
          } catch (error) {
            return {
              symbol,
              result: { symbol, status: 'error', reason: error.message || String(error), phase: 'error' },
            }
          }
        })
      )

      for (const { symbol, result } of batchResults) {
        if (result.status === 'success') {
          summary.processed++
          summary.newPrices += result.pricesStored || 0
          if (result.phase === 'rest') summary.restCalls++
        } else if (result.status === 'skipped') {
          summary.skipped++
        } else {
          summary.errors.push({ ...result, type: 'price' })
          console.warn(`[price] error for ${symbol}: ${result.reason}`)
        }
      }

      if (i + BATCH_SIZE < symbolsToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  } catch (error) {
    console.error('Error in updatePriceData:', error)
    throw error
  }

  console.log(`[price] pipeline done: ${summary.processed} processed, ${summary.errors.length} errors, ${Date.now() - t0}ms`)

  return summary
}
