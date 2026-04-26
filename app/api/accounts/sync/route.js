import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import * as accountClient from '@/services/accountClient'
import Account from '@/models/AccountsList'

export async function POST(request) {
  try {
    const auth = await requireAuth()
    if (!auth) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
    }

    await connectDB()
    const user = await User.findById(auth.id)
    if (!user || !user.userId) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Missing userId' } }, { status: 400 })
    }

    const userSecret = user.userSecret
    if (!userSecret) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Missing userSecret' } }, { status: 400 })
    }

    const snapAccounts = await accountClient.listAccounts(user.userId, userSecret)

    const results = []
    for (const acct of snapAccounts) {
      const saved = await Account.findOneAndUpdate(
        { accountId: acct.id },
        {
          $set: {
            userId: user.userId,
            accountId: acct.id,
            brokerageAuthorizationId: acct.brokerage_authorization_id || '',
            accountName: acct.name || 'Unnamed Account',
            number: acct.number || '',
            currency: acct.currency?.code || 'USD',
            institutionName: acct.institution_name || 'Unknown',
            status: acct.status || 'open',
          },
        },
        { upsert: true, new: true }
      )
      results.push(saved)
    }

    return NextResponse.json({
      message: 'Accounts synced',
      accounts: results.length,
      total: results.length,
    })
  } catch (error) {
    console.error('Sync accounts error:', error)
    return NextResponse.json(
      { error: { code: 'SYNC_FAILED', message: 'Failed to sync accounts' } },
      { status: 500 }
    )
  }
}
