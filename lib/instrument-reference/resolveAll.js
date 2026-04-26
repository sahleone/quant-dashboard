import { resolveInstrumentMarket } from '@/lib/instrument-reference/resolver.js'
import { SUPPORTED_PRICE_MARKETS } from '@/lib/instrument-reference/constants.js'

export async function resolveAll(rawTickers) {
  return Promise.all(rawTickers.map((raw) => resolveInstrumentMarket(raw)))
}

export function routeByMarket(results) {
  const equityTickers = []
  const cryptoTickers = []
  const skipped = []
  const unsupported = []

  for (const r of results) {
    if (r.status === 'unknown') {
      console.warn(`[instruments] skipping ${r.tickerUpper ?? r.details}: ${r.reason}`)
      skipped.push(r)
      continue
    }

    const { market, classificationOutcome: outcome } = r

    if (!market || outcome === 'confirmed_absent' || outcome === 'unresolved') {
      skipped.push(r)
      continue
    }

    if (!SUPPORTED_PRICE_MARKETS.includes(market)) {
      console.log(`[instruments] unsupported market for ${r.tickerUpper}: ${market}`)
      unsupported.push(r)
      continue
    }

    if (market === 'stocks') equityTickers.push(r.tickerUpper)
    if (market === 'crypto') cryptoTickers.push(r.tickerUpper)
  }

  return { equityTickers, cryptoTickers, skipped, unsupported }
}
