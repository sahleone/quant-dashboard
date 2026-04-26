'use client'

import { useContext, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import UserContext from '@/context/UserContext'

export default function useAuth() {
  const { user } = useContext(UserContext)
  const router = useRouter()

  useEffect(() => {
    if (user === null) router.replace('/')
  }, [user, router])

  return user
}
