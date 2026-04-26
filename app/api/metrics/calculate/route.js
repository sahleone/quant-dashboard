import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import fullSyncForUser from '@/utils/fullSyncForUser'

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

    let body = {}
    try { body = await request.json() } catch {  }

    const fullSync = body?.fullSync === true
    const steps = body?.steps || undefined

    const result = await fullSyncForUser(user.userId, user.userSecret, { fullSync, steps })

    return NextResponse.json({
      success: result.success,
      userId: user.userId,
      sync: result.sync
        ? { accounts: result.sync.accounts?.length ?? 0, holdings: result.sync.holdings?.length ?? 0, success: result.sync.success }
        : null,
      metrics: result.metrics
        ? {
            totalAccounts: result.metrics?.metrics?.totalAccounts ?? 0,
            calculated: result.metrics?.metrics?.calculated ?? 0,
            stored: result.metrics?.metrics?.stored ?? 0,
            errors: result.metrics?.errors ?? [],
          }
        : null,
      errors: result.errors,
    })
  } catch (error) {
    console.error('Calculate metrics error:', error)
    return NextResponse.json(
      { error: { code: 'CALCULATION_FAILED', message: 'Failed to calculate metrics' } },
      { status: 500 }
    )
  }
}
