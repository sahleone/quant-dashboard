import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import Connection from '@/models/Connection'
import * as connectionsClient from '@/services/connectionsClient'
import Account from '@/models/AccountsList'
import AccountHoldings from '@/models/AccountHoldings'
import AccountPositions from '@/models/AccountPositions'
import AccountBalances from '@/models/AccountBalances'
import AccountDetail from '@/models/AccountDetail'
import AccountOrders from '@/models/AccountOrders'
import AccountActivities from '@/models/AccountActivities'
import PortfolioTimeseries from '@/models/PortfolioTimeseries'
import EquitiesWeightTimeseries from '@/models/EquitiesWeightTimeseries'
import Options from '@/models/Options'
import Metrics from '@/models/Metrics'

export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuth()
    if (!auth) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
    }

    const { id } = await params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: { code: 'INVALID_ID', message: 'Invalid ID format' } }, { status: 400 })
    }

    await connectDB()
    const user = await User.findById(auth.id)
    if (!user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } }, { status: 401 })
    }

    const connection = await Connection.findOne({ _id: id, userId: user.userId })
    if (!connection) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Connection not found' } }, { status: 404 })
    }

    await connectionsClient.removeBrokerageAuthorization(user.userId, user.userSecret, connection.connectionId)

    const linkedAccounts = await Account.find({
      userId: user.userId,
      brokerageAuthorizationId: connection.connectionId
    }).lean()

    if (linkedAccounts.length > 0) {
      const accountIds = linkedAccounts.map(a => a.accountId)
      await Promise.all([
        AccountHoldings.deleteMany({ accountId: { $in: accountIds } }),
        AccountPositions.deleteMany({ accountId: { $in: accountIds } }),
        AccountBalances.deleteMany({ accountId: { $in: accountIds } }),
        AccountDetail.deleteMany({ accountId: { $in: accountIds } }),
        AccountOrders.deleteMany({ accountId: { $in: accountIds } }),
        AccountActivities.deleteMany({ accountId: { $in: accountIds } }),
        PortfolioTimeseries.deleteMany({ accountId: { $in: accountIds } }),
        EquitiesWeightTimeseries.deleteMany({ accountId: { $in: accountIds } }),
        Options.deleteMany({ accountId: { $in: accountIds } }),
        Metrics.deleteMany({ accountId: { $in: accountIds } }),
        Account.deleteMany({ accountId: { $in: accountIds } }),
      ])
    }

    await Connection.findByIdAndDelete(id)

    return NextResponse.json({ message: 'Connection removed successfully', connectionId: id })
  } catch (error) {
    console.error('Error removing connection:', error)
    return NextResponse.json(
      { error: { code: 'CONNECTION_REMOVAL_FAILED', message: 'Failed to remove connection' } },
      { status: 500 }
    )
  }
}
