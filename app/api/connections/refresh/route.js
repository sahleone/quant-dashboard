import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import updateConnectionsForUser from '@/utils/updateConnections'

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

    const results = await updateConnectionsForUser(user.userId, user.userSecret)

    return NextResponse.json({
      message: 'Connections refreshed',
      connections: results,
      total: results.length,
    })
  } catch (err) {
    console.error(`Error refreshing connections:`, err?.message || err)
    return NextResponse.json(
      { error: { code: 'REFRESH_FAILED', message: 'Failed to refresh connections' } },
      { status: 500 }
    )
  }
}
