import mongoose from 'mongoose'
import * as portfolioSnapshotMetrics from '@/lib/metrics/helpers/portfolioSnapshotMetrics'
import * as returnsMetrics from '@/lib/metrics/helpers/returnsMetrics'
import * as riskMetrics from '@/lib/metrics/helpers/riskMetrics'
import * as riskAdjustedMetrics from '@/lib/metrics/helpers/riskAdjustedMetrics'
import { getAnnualizedRiskFreeRate } from '@/services/famaFrenchService'
import { getDateRange } from '@/lib/metrics/helpers/dateRanges'

async function fetchBenchmarkReturns(startDate, endDate, db, portfolioReturnsByDate = null) {
  const priceHistoryCollection = db.collection('pricehistories')

  const prices = await priceHistoryCollection
    .find({ symbol: 'SPY', date: { $gte: startDate, $lte: endDate } })
    .sort({ date: 1 })
    .toArray()

  if (prices.length < 2) return null

  const benchmarkReturnsByDate = new Map()
  for (let i = 1; i < prices.length; i++) {
    const prevPrice = prices[i - 1].close
    const currPrice = prices[i].close
    if (prevPrice > 0) {
      const dateStr = new Date(prices[i].date).toISOString().split('T')[0]
      benchmarkReturnsByDate.set(dateStr, (currPrice - prevPrice) / prevPrice)
    }
  }

  if (portfolioReturnsByDate && portfolioReturnsByDate.size > 0) {
    const alignedBenchmark = []
    const alignedPortfolio = []
    for (const [dateStr, portfolioReturn] of portfolioReturnsByDate) {
      if (benchmarkReturnsByDate.has(dateStr)) {
        alignedBenchmark.push(benchmarkReturnsByDate.get(dateStr))
        alignedPortfolio.push(portfolioReturn)
      }
    }
    if (alignedBenchmark.length < 2) return null
    return { benchmarkReturns: alignedBenchmark, portfolioReturns: alignedPortfolio }
  }

  const allBenchmark = Array.from(benchmarkReturnsByDate.values())
  return allBenchmark.length >= 2 ? { benchmarkReturns: allBenchmark, portfolioReturns: null } : null
}

async function calculatePeriodMetrics(accountId, userId, period, asOfDate, db, riskFreeRate) {
  const { startDate: periodStart, endDate } = getDateRange(period, asOfDate)

  const portfolioCollection = db.collection('portfoliotimeseries')
  const query = { accountId, date: { $lte: endDate } }
  if (periodStart) query.date.$gte = periodStart

  const portfolioData = await portfolioCollection.find(query).sort({ date: 1 }).toArray()

  if (portfolioData.length === 0) return null

  const actualStartDate = periodStart || new Date(portfolioData[0].date)
  actualStartDate.setHours(0, 0, 0, 0)

  const activitiesCollection = db.collection('snaptradeaccountactivities')
  const activities = await activitiesCollection
    .find({
      accountId,
      $or: [
        { trade_date: { $gte: actualStartDate, $lte: endDate } },
        { date: { $gte: actualStartDate, $lte: endDate } },
      ],
    })
    .toArray()

  const returns = portfolioData.map((pt) => pt.simpleReturns).filter((r) => r !== null && r !== undefined)
  const equityIndex = portfolioData.map((pt) => pt.equityIndex).filter((ei) => ei !== null && ei !== undefined)

  const latest = portfolioData[portfolioData.length - 1]

  const metrics = {}
  metrics.aum = portfolioSnapshotMetrics.calculateAUM(portfolioData)
  const allocation = portfolioSnapshotMetrics.calculateAssetAllocation(latest.positions || [], latest.totalValue || 0)
  metrics.hhi = portfolioSnapshotMetrics.calculateHHI(allocation)
  metrics.diversificationScore = portfolioSnapshotMetrics.calculateDiversificationScore(metrics.hhi)
  metrics.dividendIncome = portfolioSnapshotMetrics.calculateDividendIncome(activities, actualStartDate, endDate)
  metrics.interestIncome = portfolioSnapshotMetrics.calculateInterestIncome(activities, actualStartDate, endDate)

  const avgPortfolioValue = portfolioData.reduce((sum, pt) => sum + (pt.totalValue || 0), 0) / portfolioData.length
  metrics.totalIncomeYield = portfolioSnapshotMetrics.calculateTotalIncomeYield(metrics.dividendIncome, metrics.interestIncome, avgPortfolioValue)

  const periodUpper = period.toUpperCase()
  let twrReturn = null

  switch (periodUpper) {
    case '3M': twrReturn = latest.twr3Months; break
    case 'YTD': twrReturn = latest.twrYearToDate; break
    case 'ALL': twrReturn = latest.twrAllTime; break
    default: break
  }

  if (twrReturn === null || twrReturn === undefined) {
    const effectiveStart = periodStart || new Date(portfolioData[0].date)
    twrReturn = returnsMetrics.calculateTWRFromDailyReturns(portfolioData, effectiveStart, endDate)
  }

  if (twrReturn === null || twrReturn === undefined) {
    twrReturn = returnsMetrics.calculateTWRFromTimeseries(portfolioData)
  }

  metrics.totalReturn = twrReturn ?? 0

  const days = Math.ceil((endDate - actualStartDate) / (1000 * 60 * 60 * 24))
  const years = days / 365.25
  if (metrics.totalReturn !== null && metrics.totalReturn !== undefined && years > 0) {
    const totalReturnFactor = 1 + metrics.totalReturn
    if (totalReturnFactor <= 0 || totalReturnFactor < 1e-10) {
      metrics.cagr = -1
    } else {
      metrics.cagr = Math.pow(totalReturnFactor, 1 / years) - 1
    }
  } else {
    metrics.cagr = 0
  }

  metrics.volatility = riskMetrics.calculateVolatility(returns, true)
  metrics.maxDrawdown = riskMetrics.calculateMaxDrawdown(equityIndex)
  metrics.var95 = riskMetrics.calculateVaRHistorical(returns, 0.95)
  metrics.cvar95 = riskMetrics.calculateCVaR(returns, metrics.var95)

  try {

    const portfolioReturnsByDate = new Map()
    for (const pt of portfolioData.slice(1)) {
      if (pt.simpleReturns !== null && pt.simpleReturns !== undefined) {
        const dateStr = new Date(pt.date).toISOString().split('T')[0]
        portfolioReturnsByDate.set(dateStr, pt.simpleReturns)
      }
    }

    const aligned = await fetchBenchmarkReturns(actualStartDate, endDate, db, portfolioReturnsByDate)

    if (aligned && aligned.benchmarkReturns && aligned.portfolioReturns) {
      const { benchmarkReturns, portfolioReturns: alignedPortfolioReturns } = aligned
      if (alignedPortfolioReturns.length === benchmarkReturns.length && alignedPortfolioReturns.length >= 2) {
        metrics.beta = riskMetrics.calculateBeta(alignedPortfolioReturns, benchmarkReturns)

        const benchmarkMeanReturn = benchmarkReturns.reduce((s, r) => s + r, 0) / benchmarkReturns.length
        const annualizedBenchmarkReturn = Math.pow(1 + benchmarkMeanReturn, 252) - 1

        metrics.alpha = riskAdjustedMetrics.calculateAlpha(metrics.cagr, riskFreeRate, metrics.beta, annualizedBenchmarkReturn)
      } else {
        metrics.beta = null
        metrics.alpha = null
      }
    } else {
      metrics.beta = null
      metrics.alpha = null
    }
  } catch (error) {
    console.warn(`Failed to calculate beta for ${accountId}:`, error.message)
    metrics.beta = null
    metrics.alpha = null
  }

  metrics.sharpe = riskAdjustedMetrics.calculateSharpeRatio(returns, riskFreeRate, true)
  metrics.sortino = riskAdjustedMetrics.calculateSortinoRatio(returns, 0, true)
  metrics.downsideDeviation = riskMetrics.calculateDownsideDeviation(returns, 0, true)
  const rawOmega = riskAdjustedMetrics.calculateOmegaRatio(returns, 0)

  if (rawOmega === Infinity) {
    metrics.omega = null
  } else {
    metrics.omega = rawOmega
  }
  metrics.calmar = riskAdjustedMetrics.calculateCalmarRatio(metrics.cagr, metrics.maxDrawdown)
  metrics.sharpeConfidenceInterval = riskAdjustedMetrics.calculateSharpeRatioConfidenceInterval(metrics.sharpe, returns.length, 0.95)
  metrics.nav = latest.totalValue || 0

  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === 'number' && !isFinite(value)) {
      console.warn(`Non-finite metric "${key}" = ${value} for account ${accountId}, period ${period}. Setting to null.`)
      metrics[key] = null
    }
  }

  return metrics
}

export async function calculateMetrics(opts = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected. Call connectDB() before running calculateMetrics.')
  }

  const userId = opts.userId || null
  const accountId = opts.accountId || null

  const db = mongoose.connection.db
  const summary = { totalAccounts: 0, totalPeriods: 0, calculated: 0, stored: 0, errors: [] }

  try {
    const portfolioCollection = db.collection('portfoliotimeseries')
    const query = {}
    if (userId) query.userId = userId
    if (accountId) query.accountId = accountId

    const accounts = await portfolioCollection.distinct('accountId', query)
    summary.totalAccounts = accounts.length

    if (accounts.length === 0) {
      console.log('No accounts found in PortfolioTimeseries')
      return summary
    }

    console.log(`Processing ${accounts.length} account(s)`)

    const riskFreeRate = await getAnnualizedRiskFreeRate()
    console.log(`[calculateMetrics] Using annualized risk-free rate: ${riskFreeRate}`)

    const periods = ['1M', '3M', 'YTD', '1Y', 'ALL']
    const now = new Date()
    const asOfDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))

    for (const acctId of accounts) {
      try {
        const samplePortfolio = await portfolioCollection.findOne({ accountId: acctId })
        if (!samplePortfolio) continue

        const acctUserId = samplePortfolio.userId
        if (!acctUserId) continue

        console.log(`Processing account ${acctId} (user ${acctUserId})...`)

        for (const period of periods) {
          try {
            summary.totalPeriods++

            const metrics = await calculatePeriodMetrics(acctId, acctUserId, period, asOfDate, db, riskFreeRate)

            if (!metrics) {
              console.log(`  - ${period}: No data available`)
              continue
            }

            const metricsCollection = db.collection('snaptrademetrics')
            await metricsCollection.updateOne(
              { userId: acctUserId, accountId: acctId, date: asOfDate, period },
              {
                $set: {
                  userId: acctUserId,
                  accountId: acctId,
                  date: asOfDate,
                  asOfDate,
                  period,
                  metrics,
                  computedAtUtc: new Date(),
                },
                $setOnInsert: { createdAt: new Date() },
              },
              { upsert: true }
            )

            summary.calculated++
            summary.stored++
            console.log(`  ${period}: Calculated and stored metrics`)
          } catch (periodError) {
            console.error(`  ${period}: Error calculating metrics:`, periodError?.message || periodError)
            summary.errors.push({ accountId: acctId, period, error: periodError?.message || String(periodError) })
          }
        }
      } catch (err) {
        console.error(`Error processing account ${acctId}:`, err?.message || err)
        summary.errors.push({ accountId: acctId, error: err?.message || String(err) })
      }
    }
  } catch (error) {
    console.error('Error in calculateMetrics:', error)
    throw error
  }

  return summary
}
