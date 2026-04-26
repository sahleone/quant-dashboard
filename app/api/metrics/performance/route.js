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
      return NextResponse.json({ message: 'No performance data available', range }, { status: 200 })
    }

    return NextResponse.json({
      returns: { totalReturn: metrics.metrics?.totalReturn, cagr: metrics.metrics?.cagr },
      volatility: metrics.metrics?.volatility,
      sharpe: metrics.metrics?.sharpe,
      sortino: metrics.metrics?.sortino,
      beta: metrics.metrics?.beta,
      alpha: metrics.metrics?.alpha,
      maxDrawdown: metrics.metrics?.maxDrawdown,
      calmar: metrics.metrics?.calmar,
      range,
      asOf: metrics.date,
    })
  } catch (error) {
    console.error('Performance metrics error:', error)
    return NextResponse.json(
      { error: { code: 'PERFORMANCE_FAILED', message: 'Failed to retrieve performance metrics' } },
      { status: 500 }
    )
  }
}
