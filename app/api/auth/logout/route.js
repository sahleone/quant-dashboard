import { NextResponse } from 'next/server'

const isProd = process.env.NODE_ENV === 'production'

export async function POST() {
  const response = NextResponse.json(
    { message: 'Logged out successfully' },
    { status: 200 }
  )

  const clearOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  }

  response.cookies.set('jwt', '', clearOptions)
  response.cookies.set('refreshToken', '', clearOptions)

  return response
}
