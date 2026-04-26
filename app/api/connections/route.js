import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import Connection from '@/models/Connection'
import * as connectionsClient from '@/services/connectionsClient'

const ALLOWED_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'ERROR']

export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
    }

    await connectDB()
    const user = await User.findById(auth.id)

    if (!user?.userSecret) {
      return NextResponse.json({
        connections: [],
        health: { total: 0, active: 0, inactive: 0, lastChecked: new Date(), source: 'database' },
        summary: { totalConnections: 0, activeConnections: 0, inactiveConnections: 0 },
      })
    }

    let storedConnections = await Connection.find({ userId: user.userId }).sort({ createdAt: 1 }).lean()
    let fetchedFromSnapTrade = false

    if (!storedConnections.length) {
      try {
        const snapConnections = await connectionsClient.listBrokerageAuthorizations(user.userId, user.userSecret)
        if (snapConnections.length) {
          const saved = []
          for (const sc of snapConnections) {
            const normalizedStatus = (sc.status || 'ACTIVE').toString().toUpperCase()
            const status = ALLOWED_STATUSES.includes(normalizedStatus) ? normalizedStatus : 'ACTIVE'

            const conn = await Connection.findOneAndUpdate(
              { userId: user.userId, connectionId: sc.id },
              {
                $set: {
                  brokerageName: sc.brokerage?.name || 'Unknown',
                  status,
                  isActive: status === 'ACTIVE',
                  lastSyncDate: sc.last_sync_at ? new Date(sc.last_sync_at) : new Date(),
                  updatedAt: new Date(),
                },
                $setOnInsert: { createdAt: new Date() },
              },
              { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            )
            saved.push(conn.toObject())
          }
          storedConnections = saved
          fetchedFromSnapTrade = true
        }
      } catch (snapError) {
        console.error('Error pulling connections from SnapTrade:', snapError)
      }
    }

    const total = storedConnections.length
    const active = storedConnections.filter((c) => c.status === 'ACTIVE').length

    const connections = storedConnections.map((c) => ({
      id: c._id,
      connectionId: c.connectionId,
      authorizationId: c.connectionId,
      brokerageName: c.brokerageName,
      status: c.status,
      isActive: c.isActive,
      lastSyncDate: c.lastSyncDate,
      createdAt: c.createdAt,
    }))

    return NextResponse.json({
      connections,
      health: { total, active, inactive: total - active, lastChecked: new Date(), source: fetchedFromSnapTrade ? 'snaptrade' : 'database' },
      summary: { totalConnections: total, activeConnections: active, inactiveConnections: total - active },
    })
  } catch (error) {
    console.error('List connections error:', error)
    return NextResponse.json(
      { error: { code: 'CONNECTIONS_LIST_FAILED', message: 'Failed to retrieve connections' } },
      { status: 500 }
    )
  }
}
