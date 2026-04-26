#!/usr/bin/env node
// Fama–French 3-factor: (Rp−Rf) ~ 1 + Mkt−Rf + SMB + HML.

import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb.js'
import PortfolioTimeseries from '../models/PortfolioTimeseries.js'
import FamaFrenchFactors from '../models/FamaFrenchFactors.js'
import {
  TRADING_DAYS_PER_YEAR,
  parseStdArgs,
  tradingDaysForMonths,
  alignFf3,
  trailingSlice,
} from './lib/betaShared.mjs'
import { olsMultivariate } from './lib/regression.mjs'

async function main() {
  const { months, accountId, userId, end } = parseStdArgs(process.argv.slice(2))
  if (!accountId || !userId) {
    console.error(
      'usage: node --env-file=.env.local data/betaFf3Daily.mjs --userId <id> --accountId <id> [--months 36] [--end ISO]'
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
      .select('date mktRf smb hml rf')
      .lean(),
  ])

  if (!ffRows.length) {
    console.error('No Fama–French rows in range.')
    process.exitCode = 1
    return
  }

  const { excessAsset, mktRf, smb, hml } = alignFf3(portfolioRows, ffRows)
  const sliced = trailingSlice([excessAsset, mktRf, smb, hml], windowTd)
  if (!sliced) {
    console.error('Not enough overlapping observations.')
    process.exitCode = 1
    return
  }
  const [y, mk, sm, hm] = sliced

  const fit = olsMultivariate(y, [mk, sm, hm])
  const c = fit?.coefficients

  console.log({
    model: 'ff3_daily',
    userId,
    accountId,
    months,
    tradingDaysTarget: windowTd,
    overlappingDays: excessAsset.length,
    regressionObs: fit?.nObs ?? 0,
    alphaDaily: c?.[0] ?? null,
    alphaAnnualApprox:
      c?.[0] != null ? Math.pow(1 + c[0], TRADING_DAYS_PER_YEAR) - 1 : null,
    betaMkt: c?.[1] ?? null,
    betaSmb: c?.[2] ?? null,
    betaHml: c?.[3] ?? null,
    r2: fit?.r2 ?? null,
    windowEnd: endDate.toISOString().slice(0, 10),
  })
}

try {
  await main()
} finally {
  await mongoose.connection.close()
}
