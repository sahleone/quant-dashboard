import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import PortfolioTimeseries from '@/models/PortfolioTimeseries'
import { aggregateTimeseriesByDate } from '@/lib/aggregatePortfolioTimeseries'

export async function GET(request) {
  try {
    const auth = await requireAuth()
    if (!auth) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
    }

    await connectDB()
    const user = await User.findById(auth.id)
    if (!user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } }, { status: 401 })
    }

    const range = request.nextUrl.searchParams.get('range') || 'ALL'
    const accountId = request.nextUrl.searchParams.get('accountId')

    const query = { userId: user.userId }
    if (accountId) query.accountId = accountId

    const now = new Date()
    if (range !== 'ALL') {
      const rangeMap = { '1M': 30, '3M': 90, '1Y': 365 }
      if (range === 'YTD') {
        query.date = { $gte: new Date(now.getFullYear(), 0, 1) }
      } else if (rangeMap[range]) {
        query.date = { $gte: new Date(now.getTime() - rangeMap[range] * 86400000) }
      }
    }

    const raw = await PortfolioTimeseries.find(query)
      .sort({ date: 1, accountId: 1 })
      .select('date totalValue stockValue cashValue simpleReturns dailyTWRReturn cumReturn accountId')
      .lean()

    const data = accountId ? raw : aggregateTimeseriesByDate(raw)

    return NextResponse.json({ data, range, count: data.length })
  } catch (error) {
    console.error('Timeseries error:', error)
    return NextResponse.json(
      { error: { code: 'TIMESERIES_FAILED', message: 'Failed to retrieve timeseries' } },
      { status: 500 }
    )
  }
}
