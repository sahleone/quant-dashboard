import { connectDB } from '@/lib/mongodb'
import InstrumentReference from '@/models/InstrumentReference'
import { normalizeTicker, NormalizationError } from './normalize.js'
import { isStale } from './staleness.js'
import { massiveReferenceGet } from '@/lib/instrument-reference/massiveClient.js'
import { KNOWN_MARKETS } from './constants.js'

export async function resolveInstrumentMarket(rawTicker, { forceRefresh = false } = {}) {
  let tickerUpper
  try {
    tickerUpper = normalizeTicker(rawTicker)
  } catch (err) {
    const msg = err instanceof NormalizationError ? err.message : String(err)
    return {
      status: 'unknown',
      source: 'normalization',
      reason: 'NORMALIZATION_ERROR',
      details: msg,
    }
  }

  await connectDB()

  if (!forceRefresh) {
    const doc = await InstrumentReference.findOne({ tickerUpper })
    if (doc && !isStale(doc)) {
      return {
        status: 'hit',
        source: 'db',
        tickerUpper,
        market: doc.market ?? null,
        classificationOutcome: doc.classificationOutcome,
        record: doc,
      }
    }
  }

  return fetchAndClassify(tickerUpper)
}

async function fetchAndClassify(tickerUpper) {
  const now = new Date()
  const { status, body, networkError } = await massiveReferenceGet(tickerUpper)

  const attemptMeta = {
    lastCheckedAt: now,
    lastHttpStatus: status,
    lastError: null,
  }

  if (networkError) {
    const meta = { ...attemptMeta, lastError: networkError }
    await upsertAttempt(tickerUpper, meta)
    return unknown(tickerUpper, 'API_ERROR', networkError)
  }

  if (status === 401 || status === 403) {
    const meta = { ...attemptMeta, lastError: `HTTP ${status}` }
    await upsertAttempt(tickerUpper, meta)
    return unknown(tickerUpper, 'UNAUTHORIZED', `HTTP ${status}`)
  }

  if (status === 429) {
    const meta = { ...attemptMeta, lastError: 'rate limit hit after retries' }
    await upsertAttempt(tickerUpper, meta)
    return unknown(tickerUpper, 'RATE_LIMITED', 'rate limit hit after retries')
  }

  if (status !== 200) {
    const msg = `unexpected HTTP ${status}`
    await upsertAttempt(tickerUpper, { ...attemptMeta, lastError: msg })
    return unknown(tickerUpper, 'API_ERROR', msg)
  }

  if (!body || body.status !== 'OK') {
    const msg = `unexpected body status: ${body?.status ?? 'missing'}`
    await upsertAttempt(tickerUpper, { ...attemptMeta, lastError: msg })
    return unknown(tickerUpper, 'API_ERROR', msg)
  }

  if (!Array.isArray(body.results)) {
    const msg = 'results field missing or not array'
    await upsertAttempt(tickerUpper, { ...attemptMeta, lastError: msg })
    return unknown(tickerUpper, 'API_ERROR', msg)
  }

  const successMeta = { ...attemptMeta, lastSuccessAt: now, lastError: null }
  const R = body.results

  if (R.length === 0) {
    await upsertSuccess(tickerUpper, successMeta, {
      classificationOutcome: 'confirmed_absent',
      market: null,
      massiveTicker: null,
      active: null,
      type: null,
      locale: null,
      primaryExchange: null,
      name: null,
      ambiguityCandidates: [],
    })
    return unknown(tickerUpper, 'NOT_FOUND', 'Massive returned empty results')
  }

  const resolved = resolveResults(R, tickerUpper)

  if (resolved.type === 'ambiguous') {
    await upsertSuccess(tickerUpper, successMeta, {
      classificationOutcome: 'unresolved',
      market: null,
      massiveTicker: null,
      active: null,
      type: null,
      locale: null,
      primaryExchange: null,
      name: null,
      ambiguityCandidates: resolved.candidates.slice(0, 5),
    })
    return unknown(tickerUpper, 'AMBIGUOUS', `${R.length} results, tie-break unresolved`)
  }

  if (resolved.type === 'error') {
    await upsertAttempt(tickerUpper, { ...attemptMeta, lastError: resolved.details })
    return unknown(tickerUpper, 'API_ERROR', resolved.details)
  }

  const r = resolved.result
  const doc = await upsertSuccess(tickerUpper, successMeta, {
    classificationOutcome: 'classified',
    market: r.market,
    massiveTicker: r.ticker ?? null,
    active: typeof r.active === 'boolean' ? r.active : null,
    type: r.type ?? null,
    locale: r.locale ?? null,
    primaryExchange: r.primary_exchange ?? null,
    name: r.name ?? null,
    ambiguityCandidates: [],
  })

  return {
    status: 'fetched',
    source: 'massive',
    tickerUpper,
    market: r.market,
    classificationOutcome: 'classified',
    record: doc,
  }
}

function resolveResults(results, tickerUpper) {
  for (const r of results) {
    if (!KNOWN_MARKETS.includes(r.market)) {
      return { type: 'error', details: `unrecognized market value: "${r.market}"` }
    }
  }

  if (results.length === 1) return { type: 'ok', result: results[0] }

  let candidates = results

  const exactMatch = candidates.filter((r) => r.ticker?.toUpperCase() === tickerUpper)
  if (exactMatch.length === 1) return { type: 'ok', result: exactMatch[0] }
  if (exactMatch.length > 1) candidates = exactMatch

  const activeOnly = candidates.filter((r) => r.active === true)
  if (activeOnly.length === 1) return { type: 'ok', result: activeOnly[0] }
  if (activeOnly.length > 1) candidates = activeOnly

  const usOnly = candidates.filter((r) => r.locale === 'us')
  if (usOnly.length === 1) return { type: 'ok', result: usOnly[0] }

  return { type: 'ambiguous', candidates: results.map((r) => r.ticker ?? '?') }
}

async function upsertAttempt(tickerUpper, meta) {
  await InstrumentReference.updateOne({ tickerUpper }, { $set: { tickerUpper, ...meta } }, { upsert: true })
}

async function upsertSuccess(tickerUpper, attemptMeta, classificationFields) {
  return InstrumentReference.findOneAndUpdate(
    { tickerUpper },
    { $set: { tickerUpper, ...attemptMeta, ...classificationFields } },
    { upsert: true, new: true }
  )
}

function unknown(tickerUpper, reason, details) {
  return { status: 'unknown', source: 'massive', reason, tickerUpper, details }
}
