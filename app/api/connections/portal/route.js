import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import { createSnapTradeUser, generateConnectionPortalUrl } from '@/services/userClient'

export async function POST(request) {
  try {
    const auth = await requireAuth()
    if (!auth) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
    }

    await connectDB()
    let user = await User.findById(auth.id)
    if (!user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } }, { status: 401 })
    }

    if (!user.userSecret) {
      await createSnapTradeUser(user.userId)
      user = await User.findById(auth.id)
    }

    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const { broker: rawBroker, customRedirect, connectionType } = body
    const broker =
      typeof rawBroker === 'string' && rawBroker.trim().length > 0 ? rawBroker.trim() : undefined

    const portalData = await generateConnectionPortalUrl(user.userId, user.userSecret, {
      broker,
      customRedirect: customRedirect || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings`,
      connectionType: connectionType || 'read',
    })

    return NextResponse.json({
      redirectUrl: portalData.redirectURI,
      portalId: portalData.id,
      expiresAt: portalData.expiresAt,
    })
  } catch (error) {
    console.error('Error generating connection portal:', error)
    return NextResponse.json(
      { error: { code: 'PORTAL_GENERATION_FAILED', message: 'Failed to generate connection portal' } },
      { status: 500 }
    )
  }
}
