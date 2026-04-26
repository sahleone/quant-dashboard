#!/usr/bin/env node
// CAPM OLS: (Rp−Rf) ~ 1 + (Mkt−Rf). Jensen alpha = intercept; slope = market beta.

import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb.js'
import PortfolioTimeseries from '../models/PortfolioTimeseries.js'
import FamaFrenchFactors from '../models/FamaFrenchFactors.js'
import {
  TRADING_DAYS_PER_YEAR,
  parseStdArgs,
  tradingDaysForMonths,
  alignCapmFf,
  trailingSlice,
} from './lib/betaShared.mjs'
import { olsMultivariate } from './lib/regression.mjs'

async function main() {
  const { months, accountId, userId, end } = parseStdArgs(process.argv.slice(2))
  if (!accountId || !userId) {
    console.error(
      'usage: node --env-file=.env.local data/betaCapmFfOlsDaily.mjs --userId <id> --accountId <id> [--months 36] [--end ISO]'
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
  const sliced = trailingSlice([excessAsset, marketExcess], windowTd)
  if (!sliced) {
    console.error('Not enough overlapping observations.')
    process.exitCode = 1
    return
  }
  const [y, mkt] = sliced

  const fit = olsMultivariate(y, [mkt])
  const alphaDaily = fit?.coefficients?.[0] ?? null
  const betaMkt = fit?.coefficients?.[1] ?? null

  console.log({
    model: 'capm_ff_ols',
    userId,
    accountId,
    months,
    tradingDaysTarget: windowTd,
    overlappingDays: excessAsset.length,
    regressionObs: fit?.nObs ?? 0,
    alphaDaily,
    alphaAnnualApprox:
      alphaDaily !== null ? Math.pow(1 + alphaDaily, TRADING_DAYS_PER_YEAR) - 1 : null,
    betaMkt,
    r2: fit?.r2 ?? null,
    windowEnd: endDate.toISOString().slice(0, 10),
  })
}

try {
  await main()
} finally {
  await mongoose.connection.close()
}
