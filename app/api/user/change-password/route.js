import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import User from '@/models/Users'
import bcrypt from 'bcryptjs'

export async function POST(request) {
  try {
    const auth = await requireAuth()
    if (!auth) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 },
      )
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'currentPassword and newPassword are required' } },
        { status: 400 },
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters' } },
        { status: 400 },
      )
    }

    await connectDB()
    const user = await User.findById(auth.id)
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User not found' } },
        { status: 401 },
      )
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return NextResponse.json(
        { error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } },
        { status: 401 },
      )
    }

    const salt = await bcrypt.genSalt()
    user.password = await bcrypt.hash(newPassword, salt)
    await user.save()

    return NextResponse.json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: { code: 'PASSWORD_CHANGE_FAILED', message: 'Failed to change password' } },
      { status: 500 },
    )
  }
}
