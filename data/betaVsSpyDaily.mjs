#!/usr/bin/env node
// Beta vs SPY total returns (aligned calendar days), same spirit as dashboard benchmark — not excess-over-RF.

import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb.js'
import PortfolioTimeseries from '../models/PortfolioTimeseries.js'
import {
  utcDay,
  parseStdArgs,
  tradingDaysForMonths,
  trailingSlice,
} from './lib/betaShared.mjs'
import { calculateBeta } from '../lib/metrics/helpers/riskMetrics.js'

function spyCloseToDailyReturns(rows) {
  const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date))
  const retByDate = new Map()
  for (let i = 1; i < sorted.length; i++) {
    const d1 = utcDay(sorted[i].date)
    const c0 = sorted[i - 1].close
    const c1 = sorted[i].close
    if (c0 > 0 && c1 > 0 && Number.isFinite(c0) && Number.isFinite(c1)) {
      retByDate.set(d1, (c1 - c0) / c0)
    }
  }
  return retByDate
}

function alignPortfolioSpy(portfolioRows, spyRetByDate) {
  const p = []
  const s = []
  for (const pt of portfolioRows) {
    const day = utcDay(pt.date)
    const sr = pt.simpleReturns
    const br = spyRetByDate.get(day)
    if (sr === null || sr === undefined || !Number.isFinite(sr)) continue
    if (br === undefined || !Number.isFinite(br)) continue
    p.push(sr)
    s.push(br)
  }
  return { portfolio: p, spy: s }
}

async function main() {
  const { months, accountId, userId, end } = parseStdArgs(process.argv.slice(2))
  if (!accountId || !userId) {
    console.error(
      'usage: node --env-file=.env.local data/betaVsSpyDaily.mjs --userId <id> --accountId <id> [--months 36] [--end ISO]'
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

  const db = mongoose.connection.db
  const [portfolioRows, spyPrices] = await Promise.all([
    PortfolioTimeseries.find({ userId, accountId, date: { $gte: startDate, $lte: endDate } })
      .sort({ date: 1 })
      .select('date simpleReturns')
      .lean(),
    db
      .collection('pricehistories')
      .find({ symbol: 'SPY', date: { $gte: startDate, $lte: endDate } })
      .sort({ date: 1 })
      .project({ date: 1, close: 1 })
      .toArray(),
  ])

  const spyRetByDate = spyCloseToDailyReturns(spyPrices)
  const { portfolio, spy } = alignPortfolioSpy(portfolioRows, spyRetByDate)
  const sliced = trailingSlice([portfolio, spy], windowTd)
  if (!sliced) {
    console.error('Not enough aligned SPY / portfolio days.')
    process.exitCode = 1
    return
  }
  const [pWin, sWin] = sliced
  const beta = calculateBeta(pWin, sWin)

  console.log({
    model: 'vs_spy_total_return',
    userId,
    accountId,
    months,
    tradingDaysTarget: windowTd,
    spyPriceRows: spyPrices.length,
    portfolioRows: portfolioRows.length,
    overlappingDays: portfolio.length,
    betaSpy: beta,
    observationsInRegression: pWin.length,
    windowEnd: endDate.toISOString().slice(0, 10),
  })
}

try {
  await main()
} finally {
  await mongoose.connection.close()
}
