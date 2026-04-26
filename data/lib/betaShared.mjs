export const TRADING_DAYS_PER_YEAR = 252

export function utcDay(d) {
  return new Date(d).toISOString().slice(0, 10)
}

export function tradingDaysForMonths(months) {
  return Math.max(20, Math.round((months / 12) * TRADING_DAYS_PER_YEAR))
}

export function parseStdArgs(argv) {
  const out = { months: 36, accountId: null, userId: null, end: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--months' && argv[i + 1]) {
      out.months = Number(argv[++i])
      continue
    }
    if (a === '--accountId' && argv[i + 1]) {
      out.accountId = argv[++i]
      continue
    }
    if (a === '--userId' && argv[i + 1]) {
      out.userId = argv[++i]
      continue
    }
    if (a === '--end' && argv[i + 1]) {
      out.end = new Date(argv[++i])
      continue
    }
  }
  return out
}

export function trailingSlice(arrays, windowTradingDays) {
  const len = arrays[0]?.length ?? 0
  if (!len || windowTradingDays < 2) return null
  const n = Math.min(windowTradingDays, len)
  const start = len - n
  return arrays.map((a) => a.slice(start))
}

/** Excess portfolio return vs FF Mkt-RF (CAPM inputs). */
export function alignCapmFf(portfolioRows, ffRows) {
  const ffByDay = new Map(ffRows.map((r) => [utcDay(r.date), r]))
  const excessAsset = []
  const marketExcess = []
  for (const pt of portfolioRows) {
    const row = ffByDay.get(utcDay(pt.date))
    if (!row) continue
    const sr = pt.simpleReturns
    if (sr === null || sr === undefined || !Number.isFinite(sr)) continue
    const { rf, mktRf } = row
    if (!Number.isFinite(rf) || !Number.isFinite(mktRf)) continue
    excessAsset.push(sr - rf)
    marketExcess.push(mktRf)
  }
  return { excessAsset, marketExcess }
}

/** Excess return plus all three FF factors for the same dates. */
export function alignFf3(portfolioRows, ffRows) {
  const ffByDay = new Map(ffRows.map((r) => [utcDay(r.date), r]))
  const y = []
  const mktRf = []
  const smb = []
  const hml = []
  for (const pt of portfolioRows) {
    const row = ffByDay.get(utcDay(pt.date))
    if (!row) continue
    const sr = pt.simpleReturns
    if (sr === null || sr === undefined || !Number.isFinite(sr)) continue
    const { rf, mktRf: mk, smb: sm, hml: hm } = row
    if (!Number.isFinite(rf) || !Number.isFinite(mk) || !Number.isFinite(sm) || !Number.isFinite(hm))
      continue
    y.push(sr - rf)
    mktRf.push(mk)
    smb.push(sm)
    hml.push(hm)
  }
  return { excessAsset: y, mktRf, smb, hml }
}

export function capmAlphaDaily(excessAsset, marketExcess, beta, windowTradingDays) {
  if (beta === null || beta === undefined || !Number.isFinite(beta)) return null
  const sliced = trailingSlice([excessAsset, marketExcess], windowTradingDays)
  if (!sliced) return null
  const [y, x] = sliced
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length
  return mean(y) - beta * mean(x)
}
