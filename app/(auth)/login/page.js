'use client'

import { useContext, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import UserContext from '@/context/UserContext'
import Login from '@/components/login/Login'

export default function LoginPage() {
  const { user } = useContext(UserContext)
  const router = useRouter()

  useEffect(() => {
    if (user) router.replace('/dashboard')
  }, [user, router])

  if (user) return null

  return (
    <div className="home-page">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>QuantDashboard</h1>
        <p>Sign in to your account</p>
      </div>
      <div className="auth-forms">
        <Login />
      </div>
    </div>
  )
}
