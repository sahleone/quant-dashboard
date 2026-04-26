import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import Activities from '@/models/AccountActivities'

const DIVIDEND_TYPES = ['DIVIDEND', 'STOCK_DIVIDEND']

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

    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 12)

    const query = {
      userId: user.userId,
      type: { $in: DIVIDEND_TYPES },
      date: { $gte: startDate, $lte: endDate },
    }

    if (accountId) query.accountId = accountId

    const activities = await Activities.find(query).sort({ date: -1 }).lean()

    const dividends = activities.map((a) => ({
      _id: a._id,
      symbol: a.symbol || null,

      payDate: a.settlement_date || a.date || null,

      exDate: a.trade_date || a.date || null,

      totalAmount: a.amount || 0,
      amount: a.amount || 0,

      amountPerShare:
        a.units && a.units > 0
          ? (a.amount || 0) / a.units
          : (a.price || null),

      frequency: null,
      currency: a.currency || null,
      type: a.type,
    }))

    const annualIncome = dividends.reduce((sum, d) => sum + (d.totalAmount || 0), 0)

    return NextResponse.json({
      dividends,
      summary: {
        annualIncome,

        yield: null,
      },
    })
  } catch (error) {
    console.error('Dividends by month error:', error)
    return NextResponse.json(
      { error: { code: 'DIVIDENDS_RETRIEVAL_FAILED', message: 'Failed to retrieve dividends' } },
      { status: 500 }
    )
  }
}
