'use client'

import { useState, useEffect } from 'react'
import UserContext from '@/context/UserContext'
import { PortfolioProvider } from '@/context/PortfolioContext'
import NavBar from '@/components/navbar/NavBar'

export function Providers({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/user/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const dataUser = data?.user ?? data ?? null
          if (dataUser) {
            setUser({
              ...dataUser,
              userId: dataUser.userId ?? dataUser.id ?? null,
            })
          }
        }
      } catch {
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const setUserId = (id) => {
    setUser((prev) => ({ ...(prev || {}), userId: id }))
  }

  if (isLoading) return <div className="loading">Loading...</div>

  const shell = (
    <>
      <NavBar />
      <main>{children}</main>
    </>
  )

  return (
    <UserContext.Provider value={{ user, setUser, userId: user?.userId ?? null, setUserId }}>
      <div className="app">
        {user ? <PortfolioProvider>{shell}</PortfolioProvider> : shell}
      </div>
    </UserContext.Provider>
  )
}
