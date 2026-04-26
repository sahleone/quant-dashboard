import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import Metrics from '@/models/Metrics'

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

    const range = request.nextUrl.searchParams.get('range') || '1Y'
    const accountId = request.nextUrl.searchParams.get('accountId')

    const q = { userId: user.userId, period: range }
    if (accountId) q.accountId = accountId

    const metrics = await Metrics.findOne(q)
      .sort({ date: -1 })
      .lean()

    if (!metrics) {
      return NextResponse.json({ message: 'No risk data available', range }, { status: 200 })
    }

    return NextResponse.json({
      var95: metrics.metrics?.var95,
      cvar95: metrics.metrics?.cvar95,
      volatility: metrics.metrics?.volatility,
      beta: metrics.metrics?.beta,
      maxDrawdown: metrics.metrics?.maxDrawdown,
      downsideDeviation: metrics.metrics?.downsideDeviation,
      sharpeConfidenceInterval: metrics.metrics?.sharpeConfidenceInterval,
      range,
      asOf: metrics.date,
    })
  } catch (error) {
    console.error('Risk metrics error:', error)
    return NextResponse.json(
      { error: { code: 'RISK_FAILED', message: 'Failed to retrieve risk metrics' } },
      { status: 500 }
    )
  }
}
