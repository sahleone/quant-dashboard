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

    if (!metrics?.metrics) {
      return NextResponse.json({ message: 'No KPI data available', range }, { status: 200 })
    }

    const m = metrics.metrics
    return NextResponse.json({
      kpis: {
        aum: m.aum,
        totalReturn: m.totalReturn,
        cagr: m.cagr,
        sharpe: m.sharpe,
        sortino: m.sortino,
        maxDrawdown: m.maxDrawdown,
        volatility: m.volatility,
        beta: m.beta,
        alpha: m.alpha,
        hhi: m.hhi,
        diversificationScore: m.diversificationScore,
      },
      range,
      lastUpdated: metrics.date,
    })
  } catch (error) {
    console.error('KPIs error:', error)
    return NextResponse.json(
      { error: { code: 'KPIS_FAILED', message: 'Failed to retrieve KPIs' } },
      { status: 500 }
    )
  }
}
