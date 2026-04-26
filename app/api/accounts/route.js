import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import Account from '@/models/AccountsList'
import AccountHoldings from '@/models/AccountHoldings'
import AccountPositions from '@/models/AccountPositions'
import AccountBalances from '@/models/AccountBalances'
import PortfolioTimeseries from '@/models/PortfolioTimeseries'

async function countDistinctSymbolsLatestBatch(Model, match, symbolField) {
  const rows = await Model.aggregate([
    { $match: { ...match, [symbolField]: { $exists: true, $nin: [null, ''] } } },
    {
      $addFields: {
        batchSecond: { $dateTrunc: { date: '$asOfDate', unit: 'second' } },
      },
    },
    { $group: { _id: '$batchSecond', symbols: { $addToSet: `$${symbolField}` } } },
    { $sort: { _id: -1 } },
    { $limit: 1 },
    { $project: { _id: 0, count: { $size: '$symbols' } } },
  ])
  return rows[0]?.count ?? 0
}

function toNumber(value) {
  const n = parseFloat(value)
  return isNaN(n) ? 0 : n
}

export async function GET() {
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

    const accounts = await Account.find({ userId: user.userId }).lean()

    const accountsWithSummary = await Promise.all(
      accounts.map(async (account) => {
        const match = { userId: user.userId, accountId: account.accountId }

        const [latestTs, holdingSymbols, latestBal, holdingsCountLatestBatch] = await Promise.all([
          PortfolioTimeseries.findOne(match).sort({ date: -1 }).lean(),
          AccountHoldings.aggregate([
            { $match: match },
            { $sort: { asOfDate: -1 } },
            { $group: { _id: '$symbol', doc: { $first: '$$ROOT' } } },
          ]),
          AccountBalances.findOne(match).sort({ asOfDate: -1 }).lean(),
          countDistinctSymbolsLatestBatch(AccountHoldings, match, 'symbol'),
        ])

        const holdingsFromRows = holdingSymbols.reduce((sum, row) => sum + toNumber(row.doc?.marketValue), 0)

        let totalValue
        const balVal = latestBal ? toNumber(latestBal.accountBalance) : 0
        if (balVal > 0) {

          totalValue = balVal
        } else if (latestTs != null && toNumber(latestTs.totalValue) > 0) {

          totalValue = toNumber(latestTs.totalValue)
        } else if (holdingsFromRows > 0) {
          totalValue = holdingsFromRows
        } else {
          totalValue = 0
        }

        let holdingsCount = holdingsCountLatestBatch
        if (holdingsCount === 0) {
          holdingsCount = await countDistinctSymbolsLatestBatch(AccountPositions, match, 'symbolTicker')
        }

        return {
          ...account,
          holdingsCount,
          totalValue,
        }
      })
    )

    return NextResponse.json({ accounts: accountsWithSummary, total: accounts.length })
  } catch (error) {
    console.error('List accounts error:', error)
    return NextResponse.json(
      { error: { code: 'ACCOUNTS_LIST_FAILED', message: 'Failed to retrieve accounts' } },
      { status: 500 }
    )
  }
}
