import { resolveInstrumentMarket } from './resolver.js'
import { SUPPORTED_PRICE_MARKETS } from './constants.js'

export async function resolveStatusesForSymbols(symbols) {
  const results = await Promise.all(symbols.map((s) => resolveInstrumentMarket(s)))

  return results.map((r) => {
    const tickerUpper = r.tickerUpper || String(r.details || '').toUpperCase()

    if (r.status === 'unknown') {
      return { tickerUpper, status: 'unknown', reason: r.reason || 'UNRESOLVED', isPriceEligible: false }
    }

    const { market, classificationOutcome: outcome, record } = r
    const isActive = record?.active === true
    const isPriceEligible = SUPPORTED_PRICE_MARKETS.includes(market)

    let status = 'unknown'
    if (outcome === 'classified') {
      status = isActive ? 'active' : 'inactive'
    } else if (outcome === 'confirmed_absent') {
      status = 'inactive'
    }

    return { tickerUpper, status, reason: outcome || 'UNRESOLVED', isPriceEligible }
  })
}
