#!/usr/bin/env node
// Missing portfolio days vs US equity session: Massive holiday list + SPY daily bar check.

import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb.js'
import PortfolioTimeseries from '../models/PortfolioTimeseries.js'

function massiveBase() {
  return (process.env.MASSIVE_API_BASE || 'https://api.massive.com').trim().replace(/\/$/, '')
}

function massiveKey() {
  return process.env.MASSIVE_API_KEY?.trim() || ''
}

function parseArgs(argv) {
  const out = { userId: null, accountId: null, sleepMs: 280 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--userId' && argv[i + 1]) {
      out.userId = argv[++i]
      continue
    }
    if (a === '--accountId' && argv[i + 1]) {
      out.accountId = argv[++i]
      continue
    }
    if (a === '--sleepMs' && argv[i + 1]) {
      out.sleepMs = Number(argv[++i])
      continue
    }
  }
  return out
}

function utcDayKey(d) {
  return new Date(d).toISOString().slice(0, 10)
}

/** UTC Mon–Fri dates from min..max inclusive (matches portfolio dateKey convention). */
export function utcWeekdayGaps(minDate, maxDate, present) {
  const gaps = []
  const cur = new Date(minDate)
  cur.setUTCHours(0, 0, 0, 0)
  const end = new Date(maxDate)
  end.setUTCHours(0, 0, 0, 0)
  while (cur <= end) {
    const dow = cur.getUTCDay()
    const key = utcDayKey(cur)
    if (dow >= 1 && dow <= 5 && !present.has(key)) gaps.push(key)
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return gaps
}

async function fetchListedClosedDates(base, apiKey) {
  const url = `${base}/v1/marketstatus/upcoming?apiKey=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`marketstatus/upcoming ${res.status}: ${t.slice(0, 200)}`)
  }
  const rows = await res.json()
  if (!Array.isArray(rows)) return { closedDates: new Set(), namesByDate: new Map(), rows: [] }

  const closedDates = new Set()
  const namesByDate = new Map()
  for (const r of rows) {
    if (!r?.date || r.status !== 'closed') continue
    const day = String(r.date).slice(0, 10)
    closedDates.add(day)
    const prev = namesByDate.get(day)
    const label = r.exchange ? `${r.exchange}: ${r.name || 'closed'}` : r.name || 'closed'
    namesByDate.set(day, prev ? `${prev}; ${label}` : label)
  }
  return { closedDates, namesByDate, rows }
}

async function spyDailyBarExists(base, apiKey, dateStr) {
  const url =
    `${base}/v2/aggs/ticker/SPY/range/1/day/${dateStr}/${dateStr}` +
    `?adjusted=true&sort=asc&limit=50&apiKey=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) {
    const t = await res.text()
    return { ok: false, hasBar: false, error: `${res.status} ${t.slice(0, 120)}` }
  }
  const data = await res.json()
  const n = data.resultsCount ?? data.results?.length ?? 0
  return { ok: true, hasBar: n > 0 }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const { userId, accountId, sleepMs } = parseArgs(process.argv.slice(2))
  if (!userId || !accountId) {
    console.error(
      'usage: node --env-file=.env.local data/checkTimeseriesGapsVsMarket.mjs --userId <id> --accountId <id> [--sleepMs 280]'
    )
    process.exitCode = 1
    return
  }

  const apiKey = massiveKey()
  if (!apiKey) {
    console.error('Set MASSIVE_API_KEY')
    process.exitCode = 1
    return
  }

  const base = massiveBase()

  await connectDB()

  const pts = await PortfolioTimeseries.find({ userId, accountId })
    .sort({ date: 1 })
    .select('date')
    .lean()

  if (pts.length === 0) {
    console.error('No portfolio timeseries rows for that account.')
    process.exitCode = 1
    return
  }

  const present = new Set(pts.map((p) => utcDayKey(p.date)))
  const minDate = pts[0].date
  const maxDate = pts[pts.length - 1].date
  const gaps = utcWeekdayGaps(minDate, maxDate, present)

  let holidayRows = { closedDates: new Set(), namesByDate: new Map() }
  try {
    holidayRows = await fetchListedClosedDates(base, apiKey)
  } catch (e) {
    console.warn('[warn] marketstatus/upcoming failed:', e.message)
  }

  const detail = []
  for (const day of gaps) {
    const listed = holidayRows.closedDates.has(day)
    const spy = await spyDailyBarExists(base, apiKey, day)
    await sleep(Number.isFinite(sleepMs) ? sleepMs : 280)

    let verdict
    if (!spy.ok) verdict = 'spy_check_failed'
    else if (!spy.hasBar) verdict = listed ? 'listed_holiday_no_spy_bar' : 'no_spy_bar_likely_closed'
    else if (listed) verdict = 'listed_holiday_but_spy_bar_unusual'
    else verdict = 'spy_traded_missing_timeseries'

    detail.push({
      date: day,
      listedHoliday: listed,
      holidayNote: holidayRows.namesByDate.get(day) ?? null,
      spyDailyBar: spy.hasBar,
      verdict,
      spyError: spy.ok ? null : spy.error,
    })
  }

  const summary = {
    userId,
    accountId,
    rangeStart: utcDayKey(minDate),
    rangeEnd: utcDayKey(maxDate),
    portfolioRows: pts.length,
    utcWeekdayGaps: gaps.length,
    likelyMarketClosedOrHoliday: detail.filter((r) =>
      ['listed_holiday_no_spy_bar', 'no_spy_bar_likely_closed'].includes(r.verdict)
    ).length,
    probableDataGap: detail.filter((r) => r.verdict === 'spy_traded_missing_timeseries').length,
    spyCheckErrors: detail.filter((r) => r.verdict === 'spy_check_failed').length,
  }

  console.log({ summary, gaps: detail })
}

try {
  await main()
} finally {
  await mongoose.connection.close()
}
