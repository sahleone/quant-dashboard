const TRADING_DAYS_PER_YEAR = 252

export function calculateVolatility(returns, annualized = true) {
  if (!returns || returns.length < 2) return 0
  const valid = returns.filter((r) => r !== null && r !== undefined)
  if (valid.length < 2) return 0
  const mean = valid.reduce((sum, r) => sum + r, 0) / valid.length
  const variance = valid.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (valid.length - 1)
  const stdDev = Math.sqrt(variance)
  return annualized ? stdDev * Math.sqrt(TRADING_DAYS_PER_YEAR) : stdDev
}

export function calculateDownsideDeviation(returns, targetReturn = 0, annualize = true) {
  if (!returns || returns.length < 2) return null
  const valid = returns.filter((r) => r !== null && r !== undefined)
  if (valid.length < 2) return null
  const downside = valid.map((r) => Math.min(r - targetReturn, 0))
  const sumSq = downside.reduce((sum, r) => sum + r * r, 0)
  if (sumSq === 0) return 0
  const dd = Math.sqrt(sumSq / (valid.length - 1))
  return annualize ? dd * Math.sqrt(TRADING_DAYS_PER_YEAR) : dd
}

export function calculateBeta(portfolioReturns, benchmarkReturns) {
  if (!portfolioReturns || !benchmarkReturns || portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length === 0) return null

  const pairs = []
  for (let i = 0; i < portfolioReturns.length; i++) {
    const pRet = portfolioReturns[i]
    const bRet = benchmarkReturns[i]
    if (pRet !== null && pRet !== undefined && bRet !== null && bRet !== undefined) {
      pairs.push({ portfolio: pRet, benchmark: bRet })
    }
  }

  if (pairs.length < 2) return null

  const pMean = pairs.reduce((sum, p) => sum + p.portfolio, 0) / pairs.length
  const bMean = pairs.reduce((sum, p) => sum + p.benchmark, 0) / pairs.length

  const covariance = pairs.reduce((sum, p) => sum + (p.portfolio - pMean) * (p.benchmark - bMean), 0) / (pairs.length - 1)
  const bVariance = pairs.reduce((sum, p) => sum + Math.pow(p.benchmark - bMean, 2), 0) / (pairs.length - 1)

  if (bVariance < 1e-20) return null
  return covariance / bVariance
}

export function calculateMaxDrawdown(equityIndex) {
  if (!equityIndex || equityIndex.length === 0) return 0
  const valid = equityIndex.filter((v) => v !== null && v !== undefined && !isNaN(v))
  if (valid.length === 0) return 0

  let maxDD = 0
  let peak = valid[0]

  for (let i = 1; i < valid.length; i++) {
    const value = valid[i]
    if (value > peak) {
      peak = value
    } else {
      const drawdown = (value - peak) / peak
      if (drawdown < maxDD) maxDD = drawdown
    }
  }

  return maxDD
}

export function calculateVaRHistorical(returns, confidence = 0.95) {
  if (!returns || returns.length === 0) return null
  const losses = returns.filter((r) => r !== null && r !== undefined).map((r) => -r).sort((a, b) => a - b)
  if (losses.length === 0) return null
  const index = Math.ceil(losses.length * (1 - confidence)) - 1
  return losses[Math.max(index, 0)]
}

export function calculateVaRParametric(returns, confidence = 0.95) {
  if (!returns || returns.length === 0) return null
  const valid = returns.filter((r) => r !== null && r !== undefined)
  if (valid.length < 2) return null
  const mean = valid.reduce((sum, r) => sum + r, 0) / valid.length
  const variance = valid.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (valid.length - 1)
  const std = Math.sqrt(variance)
  const zScores = { 0.95: 1.645, 0.99: 2.326, 0.9: 1.282 }
  const z = zScores[confidence] || 1.645
  return -(mean - z * std)
}

export function calculateCVaR(returns, var95) {
  if (!returns || returns.length === 0 || var95 === null || var95 === undefined) return null
  const valid = returns.filter((r) => r !== null && r !== undefined)
  if (valid.length === 0) return null
  const sorted = [...valid].sort((a, b) => a - b)
  const cutoff = Math.max(1, Math.floor(sorted.length * 0.05))
  const tailReturns = sorted.slice(0, cutoff)
  return -(tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length)
}
