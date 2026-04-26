import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import Connection from '@/models/Connection'
import * as connectionsClient from '@/services/connectionsClient'
import fullSyncForUser from '@/utils/fullSyncForUser'

const ALLOWED_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'ERROR']

export async function POST(request) {
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

    const { authorizationId } = await request.json()
    if (!authorizationId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing required parameter: authorizationId' } },
        { status: 400 }
      )
    }

    const details = await connectionsClient.getBrokerageAuthorizationDetails(
      user.userId,
      user.userSecret,
      authorizationId
    )

    const normalizedStatus = (details.status || 'ACTIVE').toString().toUpperCase()
    const status = ALLOWED_STATUSES.includes(normalizedStatus) ? normalizedStatus : 'ACTIVE'

    const connection = await Connection.findOneAndUpdate(
      { userId: user.userId, connectionId: details.id },
      {
        $set: {
          authorizationId: authorizationId || null,
          brokerageName: details.brokerage?.name || 'Unknown',
          status,
          isActive: status === 'ACTIVE',
          lastSyncDate: details.last_sync_at ? new Date(details.last_sync_at) : new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )

    fullSyncForUser(user.userId, user.userSecret, { fullSync: true }).catch((err) => {
      console.error(`[exchange] Post-connection sync failed for user ${user.userId}:`, err?.message || err)
    })

    return NextResponse.json({
      connectionId: connection._id,
      authorizationId,
      accounts: details.accounts || [],
      brokerage: { name: details.brokerage?.name || 'Unknown', id: details.brokerage?.id || details.id },
      status,
      syncTriggered: true,
    })
  } catch (error) {
    console.error('Error exchanging authorization:', error)
    return NextResponse.json(
      { error: { code: 'AUTHORIZATION_EXCHANGE_FAILED', message: 'Failed to exchange authorization' } },
      { status: 500 }
    )
  }
}
