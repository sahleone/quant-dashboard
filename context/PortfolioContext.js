'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import UserContext from '@/context/UserContext'
import { authenticatedGet } from '@/utils/apiClient'

const PortfolioContext = createContext(null)

export function PortfolioProvider({ children }) {
  const { user } = useContext(UserContext) || {}
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountIdState] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadAccounts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await authenticatedGet('/api/accounts')
      const list = res.data?.accounts ?? []
      setAccounts(list)
      setSelectedAccountIdState((current) => {
        if (!current) return null
        const ok = list.some((a) => a.accountId === current)
        if (!ok) return null
        return current
      })
    } catch (err) {
      console.error('Failed to load accounts:', err)
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const setSelectedAccountId = useCallback((id) => {
    const next = id && String(id).trim() ? String(id).trim() : null
    setSelectedAccountIdState(next)
  }, [])

  const value = useMemo(
    () => ({
      accounts,
      selectedAccountId,
      setSelectedAccountId,
      reloadAccounts: loadAccounts,
      loading,
    }),
    [accounts, selectedAccountId, setSelectedAccountId, loadAccounts, loading]
  )

  return (
    <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext)

  if (!ctx) {
    return {
      accounts: [],
      selectedAccountId: null,
      setSelectedAccountId: () => {},
      reloadAccounts: () => {},
      loading: false,
    }
  }
  return ctx
}
