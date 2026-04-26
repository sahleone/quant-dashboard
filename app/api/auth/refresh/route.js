import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/Users'
import { generateAccessToken, verifyRefreshToken } from '@/lib/auth'

const isProd = process.env.NODE_ENV === 'production'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get('refreshToken')?.value

    if (!refreshToken) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Refresh token not provided' } },
        { status: 401 }
      )
    }

    const decoded = verifyRefreshToken(refreshToken)

    await connectDB()
    const user = await User.findById(decoded.id)

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User not found' } },
        { status: 401 }
      )
    }

    const accessToken = generateAccessToken({ id: user._id.toString() })

    const response = NextResponse.json({ accessToken }, { status: 200 })
    response.cookies.set('jwt', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 15 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } },
      { status: 401 }
    )
  }
}
