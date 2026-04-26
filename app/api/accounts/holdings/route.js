import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import AccountHoldings from '@/models/AccountHoldings'
import AccountPositions from '@/models/AccountPositions'
import AccountBalances from '@/models/AccountBalances'
import TickerOverview from '@/models/TickerOverview'
import { isCryptoSymbol } from '@/utils/cryptoSymbols'

function resolveAssetClass(holding) {
  if (holding.isCashEquivalent) return 'Cash'
  if (holding.typeDescription && holding.typeDescription.trim()) {
    return holding.typeDescription.trim()
  }
  const tc = (holding.typeCode || '').toLowerCase()
  if (tc === 'cs') return 'Equities'
  if (tc === 'et') return 'ETF'
  if (tc === 'fi') return 'Fixed Income'
  if (tc === 'mf') return 'Mutual Fund'
  if (tc) return tc.toUpperCase()
  return 'Other'
}

function isBondLike(text) {
  const t = String(text || '').toLowerCase()
  return t.includes('bond') || t.includes('fixed income') || t.includes('treasury')
}

function resolveAssetClassFromPosition(p, overview = null) {
  if (p.cash_equivalent) return 'Cash'

  const ticker = String(p.symbolTicker || '').toUpperCase()
  if (isCryptoSymbol(ticker)) return 'Crypto'

  const typeDesc = String(p.positionSymbol?.symbol?.type?.description || '').trim()
  const typeCode = String(p.positionSymbol?.symbol?.type?.code || '').trim().toLowerCase()
  const overviewType = String(overview?.type || '').trim().toUpperCase()
  const description = String(
    p.positionSymbol?.symbol?.description || p.positionSymbol?.description || overview?.name || ''
  ).trim()

  if (isBondLike(typeDesc) || isBondLike(description) || overviewType === 'FI') return 'Bonds'

  if (typeCode === 'cs' || overviewType === 'CS') return 'Stocks'
  if (typeCode === 'mf' || overviewType === 'MF') return 'Mutual Funds'
  if (typeCode === 'fi') return 'Bonds'
  if (typeCode === 'et' || overviewType === 'ETF' || overviewType === 'ETV') return 'ETF'

  if (typeDesc) return typeDesc
  return 'Other'
}

function resolveSectorFromPosition(p) {
  const s = p.positionSymbol?.symbol
  if (!s || typeof s !== 'object') return null
  const raw =
    s.sector ||
    s.industry_sector ||
    s.industry ||
    s.industry_group ||
    null
  if (raw == null) return null
  const str = String(raw).trim()
  return str.length ? str : null
}

function isEtfLike(typeCode, typeDescription) {
  const code = String(typeCode || '').trim().toLowerCase()
  const desc = String(typeDescription || '').trim().toLowerCase()
  return code === 'et' || desc.includes('etf')
}

function sicDivisionSectorLabel(sicCode) {
  const raw = String(sicCode || '').trim()

  const code = parseInt(raw.slice(0, 2), 10)
  if (!Number.isFinite(code)) return null
  if (code >= 1 && code <= 9) return 'Agriculture, Forestry, and Fishing'
  if (code >= 10 && code <= 14) return 'Mining'
  if (code >= 15 && code <= 17) return 'Construction'
  if (code >= 20 && code <= 39) return 'Manufacturing'
  if (code >= 40 && code <= 49) return 'Transportation and Utilities'
  if (code >= 50 && code <= 51) return 'Wholesale Trade'
  if (code >= 52 && code <= 59) return 'Retail Trade'
  if (code >= 60 && code <= 67) return 'Finance, Insurance, and Real Estate'
  if (code >= 70 && code <= 89) return 'Services'
  if (code >= 90 && code <= 99) return 'Public Administration'
  return null
}

function fallbackCategoryForHolding(h) {
  if (h.isCashEquivalent) return 'Cash'
  if (isEtfLike(h.typeCode, h.typeDescription)) return 'ETF'
  return 'Other'
}

function fallbackCategoryForPosition(p, overview = null) {
  if (p.cash_equivalent) return 'Cash'
  if (isCryptoSymbol(String(p.symbolTicker || ''))) return 'Crypto'
  const type = p.positionSymbol?.symbol?.type
  if (isEtfLike(type?.code, type?.description)) return 'ETF'
  if (isEtfLike(overview?.type, overview?.name)) return 'ETF'
  if (isBondLike(overview?.name) || String(overview?.type || '').toUpperCase() === 'FI') return 'Bonds'
  if (String(overview?.type || '').toUpperCase() === 'CS') return 'Stocks'
  return 'Other'
}

function positionMarketValue(p) {
  const units = Number(p.units ?? 0)
  const price = Number(p.price ?? 0)
  if (Number.isFinite(units) && Number.isFinite(price)) return units * price
  return 0
}

function toNumber(value) {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof value === 'object' && typeof value.toString === 'function') {
    const n = parseFloat(String(value))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

async function getLatestCashValue(matchStage) {
  const rows = await AccountBalances.aggregate([
    { $match: matchStage },
    { $sort: { accountId: 1, asOfDate: -1 } },
    { $group: { _id: '$accountId', latestCash: { $first: '$cash' } } },
  ])
  return rows.reduce((sum, row) => sum + toNumber(row.latestCash), 0)
}

function toAllocationArray(map, keyField, totalValue) {
  if (totalValue === 0) return []
  return Object.entries(map)
    .map(([key, value]) => ({
      [keyField]: key,
      percentage: (value / totalValue) * 100,
    }))
    .sort((a, b) => b.percentage - a.percentage)
}

export async function GET(request) {
  try {
    const auth = await requireAuth()
    if (!auth) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    await connectDB()
    const user = await User.findById(auth.id)
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User not found' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (accountId !== null && accountId.trim() === '') {
      return NextResponse.json(
        { error: { code: 'INVALID_ID', message: 'Invalid accountId format' } },
        { status: 400 }
      )
    }

    const matchStage = { userId: user.userId }
    if (accountId) matchStage.accountId = accountId

    let rows = await AccountHoldings.aggregate([
      { $match: matchStage },
      { $sort: { asOfDate: -1 } },
      { $group: { _id: { accountId: '$accountId', symbol: '$symbol' }, doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
    ])

    let source = 'holdings'
    if (!rows.length) {
      rows = await AccountPositions.aggregate([
        { $match: matchStage },
        { $sort: { asOfDate: -1 } },
        { $group: { _id: { accountId: '$accountId', symbolTicker: '$symbolTicker' }, doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
      ])
      source = 'positions'
    }

    const latestCashValue = await getLatestCashValue(matchStage)

    if (rows.length === 0 && latestCashValue <= 0) {
      return NextResponse.json({
        byAssetClass: [],
        bySector: [],
        byIndustry: [],
        byExchange: [],
        totalValue: 0,
        asOf: new Date().toISOString().split('T')[0],
      })
    }

    let totalValue =
      source === 'holdings'
        ? rows.reduce((sum, h) => sum + (h.marketValue || 0), 0)
        : rows.reduce((sum, p) => sum + positionMarketValue(p), 0)

    const assetClassMap = {}
    const exchangeMap = {}
    const sectorMap = {}
    const industryMap = {}

    if (source === 'holdings') {
      rows.forEach((h) => {
        const mv = h.marketValue || 0

        const ac = resolveAssetClass(h)
        assetClassMap[ac] = (assetClassMap[ac] || 0) + mv

        const exCode =
          h.exchange && h.exchange !== 'Unknown' && h.exchange.trim() !== ''
            ? h.exchange.trim()
            : 'Other'
        exchangeMap[exCode] = (exchangeMap[exCode] || 0) + mv

        const fallback = fallbackCategoryForHolding(h)
        sectorMap[fallback] = (sectorMap[fallback] || 0) + mv
        industryMap[fallback] = (industryMap[fallback] || 0) + mv
      })
    } else {

      const tickerSet = new Set()
      for (const p of rows) {
        if (p.symbolTicker) tickerSet.add(p.symbolTicker.toUpperCase())
      }
      const positionTickers = Array.from(tickerSet)
      const overviewDocs = positionTickers.length > 0
        ? await TickerOverview.find({ tickerUpper: { $in: positionTickers } })
        : []
      const overviewMap = {}
      for (const d of overviewDocs) overviewMap[d.tickerUpper] = d

      rows.forEach((p) => {
        const mv = positionMarketValue(p)
        const overview = overviewMap[(p.symbolTicker || '').toUpperCase()]

        const ac = resolveAssetClassFromPosition(p, overview)
        assetClassMap[ac] = (assetClassMap[ac] || 0) + mv

        const ex =
          p.listingExchangeCode ||
          p.positionSymbol?.symbol?.exchange?.code ||
          p.positionSymbol?.exchange?.code ||
          ''
        const exCode =
          ex && ex !== 'Unknown' && String(ex).trim() !== '' ? String(ex).trim() : 'Other'
        exchangeMap[exCode] = (exchangeMap[exCode] || 0) + mv

        const fallback = fallbackCategoryForPosition(p, overview)

        let sector = resolveSectorFromPosition(p)
        if (!sector) {
          sector = sicDivisionSectorLabel(overview?.sicCode)
        }
        if (!sector) sector = fallback
        if (sector) {
          sectorMap[sector] = (sectorMap[sector] || 0) + mv
        }

        const industry = overview?.sicDescription || fallback
        industryMap[industry] = (industryMap[industry] || 0) + mv
      })
    }

    const inferredCash = toNumber(assetClassMap.Cash)
    const canonicalCash = Math.max(0, latestCashValue)
    totalValue = totalValue - inferredCash + canonicalCash
    assetClassMap.Cash = canonicalCash

    sectorMap.Cash = canonicalCash
    industryMap.Cash = canonicalCash

    let latestAsOf = null
    for (const r of rows) {
      if (!r.asOfDate) continue
      if (!latestAsOf || new Date(r.asOfDate) > new Date(latestAsOf)) {
        latestAsOf = r.asOfDate
      }
    }

    return NextResponse.json({
      byAssetClass: toAllocationArray(assetClassMap, 'assetClass', totalValue),
      bySector: toAllocationArray(sectorMap, 'sector', totalValue),
      byExchange: toAllocationArray(exchangeMap, 'exchange', totalValue),
      byIndustry: toAllocationArray(industryMap, 'industry', totalValue),
      totalValue,
      asOf: latestAsOf
        ? new Date(latestAsOf).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    })
  } catch (error) {
    console.error('Holdings allocation error:', error)
    return NextResponse.json(
      { error: { code: 'HOLDINGS_RETRIEVAL_FAILED', message: 'Failed to retrieve holdings' } },
      { status: 500 }
    )
  }
}
