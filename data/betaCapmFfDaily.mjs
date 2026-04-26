#!/usr/bin/env node
// CAPM (covariance ratio): beta = cov(Rp−Rf, Mkt−Rf) / var(Mkt−Rf). Same idea as riskMetrics.calculateBeta.

import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb.js'
import PortfolioTimeseries from '../models/PortfolioTimeseries.js'
import FamaFrenchFactors from '../models/FamaFrenchFactors.js'
import { calculateBeta } from '../lib/metrics/helpers/riskMetrics.js'
import {
  TRADING_DAYS_PER_YEAR,
  parseStdArgs,
  tradingDaysForMonths,
  alignCapmFf,
  trailingSlice,
  capmAlphaDaily,
} from './lib/betaShared.mjs'

function betaCovariance(excessAsset, marketExcess, windowTradingDays) {
  const sliced = trailingSlice([excessAsset, marketExcess], windowTradingDays)
  if (!sliced) return null
  const [y, x] = sliced
  return { beta: calculateBeta(y, x), nObs: y.length }
}

async function main() {
  const { months, accountId, userId, end } = parseStdArgs(process.argv.slice(2))
  if (!accountId || !userId) {
    console.error(
      'usage: node --env-file=.env.local data/betaCapmFfDaily.mjs --userId <id> --accountId <id> [--months 36] [--end ISO]'
    )
    process.exitCode = 1
    return
  }
  if (!Number.isFinite(months) || months <= 0) {
    console.error('--months must be a positive number')
    process.exitCode = 1
    return
  }

  const endDate = end ? new Date(end) : new Date()
  endDate.setUTCHours(23, 59, 59, 999)
  const lookbackMonths = Math.max(months + 6, 24)
  const startDate = new Date(endDate)
  startDate.setUTCMonth(startDate.getUTCMonth() - lookbackMonths)
  startDate.setUTCHours(0, 0, 0, 0)
  const windowTd = tradingDaysForMonths(months)

  await connectDB()

  const [portfolioRows, ffRows] = await Promise.all([
    PortfolioTimeseries.find({ userId, accountId, date: { $gte: startDate, $lte: endDate } })
      .sort({ date: 1 })
      .select('date simpleReturns')
      .lean(),
    FamaFrenchFactors.find({ date: { $gte: startDate, $lte: endDate } })
      .sort({ date: 1 })
      .select('date mktRf rf')
      .lean(),
  ])

  if (!ffRows.length) {
    console.error('No Fama–French rows in range.')
    process.exitCode = 1
    return
  }

  const { excessAsset, marketExcess } = alignCapmFf(portfolioRows, ffRows)
  const fit = betaCovariance(excessAsset, marketExcess, windowTd)
  const alphaDaily =
    fit && fit.beta !== null ? capmAlphaDaily(excessAsset, marketExcess, fit.beta, windowTd) : null

  console.log({
    model: 'capm_ff_covariance',
    userId,
    accountId,
    months,
    tradingDaysTarget: windowTd,
    ffRows: ffRows.length,
    portfolioRows: portfolioRows.length,
    overlappingDays: excessAsset.length,
    betaMkt: fit?.beta ?? null,
    alphaDaily,
    alphaAnnualApprox:
      alphaDaily !== null ? Math.pow(1 + alphaDaily, TRADING_DAYS_PER_YEAR) - 1 : null,
    observationsInRegression: fit?.nObs ?? 0,
    windowEnd: endDate.toISOString().slice(0, 10),
  })
}

try {
  await main()
} finally {
  await mongoose.connection.close()
}
