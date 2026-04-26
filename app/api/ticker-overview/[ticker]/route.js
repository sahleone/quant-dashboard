import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import TickerOverview from '@/models/TickerOverview'
import { fetchTickerOverview } from '@/lib/instrument-reference/overviewResolver'

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth()
    if (!auth) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const { ticker } = await params
    if (!ticker || typeof ticker !== 'string' || ticker.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_TICKER', message: 'Ticker is required' } },
        { status: 400 }
      )
    }

    const tickerUpper = ticker.trim().toUpperCase()

    await connectDB()

    let doc = await TickerOverview.findOne({ tickerUpper })

    if (!doc || !doc.lastSuccessAt) {

      const result = await fetchTickerOverview(tickerUpper)
      if (result.status === 'error' && !result.record?.lastSuccessAt) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: `No overview data for ${tickerUpper}` } },
          { status: 404 }
        )
      }
      doc = result.record
    }

    const overview = doc.toObject()
    delete overview._id
    delete overview.__v

    return NextResponse.json({ ticker: tickerUpper, ...overview })
  } catch (error) {
    console.error('Ticker overview error:', error)
    return NextResponse.json(
      { error: { code: 'OVERVIEW_FAILED', message: 'Failed to fetch ticker overview' } },
      { status: 500 }
    )
  }
}
