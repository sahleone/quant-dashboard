const TRADING_DAYS_PER_YEAR = 252

export function calculateSharpeRatio(returns, riskFreeRate = 0, annualized = true) {
  if (!returns || returns.length === 0) return null
  const valid = returns.filter((r) => r !== null && r !== undefined)
  if (valid.length < 2) return null

  const mean = valid.reduce((sum, r) => sum + r, 0) / valid.length
  const variance = valid.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (valid.length - 1)
  const volatility = Math.sqrt(variance)

  if (volatility < 1e-10 || !isFinite(volatility)) return null

  let annualizedReturn = mean
  let annualizedVol = volatility
  if (annualized) {
    annualizedReturn = mean * TRADING_DAYS_PER_YEAR
    annualizedVol = volatility * Math.sqrt(TRADING_DAYS_PER_YEAR)
  }

  return (annualizedReturn - riskFreeRate) / annualizedVol
}

export function calculateSortinoRatio(returns, mar = 0, annualized = true) {
  if (!returns || returns.length === 0) return null
  const valid = returns.filter((r) => r !== null && r !== undefined)
  if (valid.length < 2) return null

  const mean = valid.reduce((sum, r) => sum + r, 0) / valid.length
  const squaredDownside = valid.map((r) => {
    const deviation = r - mar
    return deviation < 0 ? deviation * deviation : 0
  })

  const sumSquaredDownside = squaredDownside.reduce((sum, d) => sum + d, 0)
  if (sumSquaredDownside === 0) return null

  const downsideVariance = sumSquaredDownside / (valid.length - 1)
  const downsideDev = Math.sqrt(downsideVariance)
  if (downsideDev < 1e-10) return null

  let annualizedReturn = mean
  let annualizedDownsideDev = downsideDev
  let annualizedMAR = mar
  if (annualized) {
    annualizedReturn = mean * TRADING_DAYS_PER_YEAR
    annualizedDownsideDev = downsideDev * Math.sqrt(TRADING_DAYS_PER_YEAR)
    annualizedMAR = mar * 252
  }

  if (!isFinite(annualizedDownsideDev) || annualizedDownsideDev < 1e-10) return null
  return (annualizedReturn - annualizedMAR) / annualizedDownsideDev
}

export function calculateSharpeRatioConfidenceInterval(sharpeRatio, n, confidence = 0.95) {
  if (sharpeRatio == null || !n || n < 2) return null
  const se = Math.sqrt((1 + 0.5 * sharpeRatio * sharpeRatio) / n)
  const z = confidence === 0.99 ? 2.576 : confidence === 0.95 ? 1.96 : 1.645
  return { lower: sharpeRatio - z * se, upper: sharpeRatio + z * se, confidence }
}

export function calculateOmegaRatio(returns, threshold = 0) {
  if (!returns || returns.length < 2) return null
  const valid = returns.filter((r) => r !== null && r !== undefined)
  if (valid.length < 2) return null

  let gainSum = 0
  let lossSum = 0
  for (const r of valid) {
    const excess = r - threshold
    if (excess > 0) gainSum += excess
    else lossSum += Math.abs(excess)
  }

  if (lossSum === 0) return gainSum > 0 ? Infinity : null
  return gainSum / lossSum
}

export function calculateCalmarRatio(annualizedReturn, maxDrawdown) {
  if (annualizedReturn == null || maxDrawdown == null || maxDrawdown === 0) return null
  return annualizedReturn / Math.abs(maxDrawdown)
}

export function calculateAlpha(portfolioReturn, riskFreeRate, beta, benchmarkReturn) {
  if (portfolioReturn == null || riskFreeRate == null || beta == null || benchmarkReturn == null) return null
  return portfolioReturn - (riskFreeRate + beta * (benchmarkReturn - riskFreeRate))
}

export function calculateReturnOverMaxDD(totalReturn, maxDrawdown) {
  if (!maxDrawdown || maxDrawdown === 0) return null
  return totalReturn / Math.abs(maxDrawdown)
}
