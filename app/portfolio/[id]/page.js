'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useAuth from '@/hooks/useAuth'
import { authenticatedGet } from '@/utils/apiClient'
import Link from 'next/link'
import { fmt, fmtPct } from '@/utils/format'

export default function AccountDetailPage() {
  const user = useAuth()
  const params = useParams()
  const router = useRouter()
  const accountId = params.id

  const [holdings, setHoldings] = useState([])
  const [accountName, setAccountName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!accountId) return

    async function fetchHoldings() {
      setLoading(true)
      setError(null)
      try {
        const res = await authenticatedGet(`/api/accounts?accountId=${encodeURIComponent(accountId)}`)
        const data = res.data
        const list = Array.isArray(data) ? data : data?.accounts ?? []
        const account = list.find((a) => a.accountId === accountId)
        if (account) {
          setAccountName(account.name || account.accountId)
          setHoldings(account.holdings || [])
        } else {
          setHoldings([])
        }
      } catch (err) {
        setError('Unable to load account holdings.')
      } finally {
        setLoading(false)
      }
    }

    fetchHoldings()
  }, [accountId])

  if (!user) return null

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/portfolio" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          ← Back to Portfolio
        </Link>
        <h1 style={{ margin: 0 }}>{accountName || 'Account Detail'}</h1>
      </div>

      {loading && <p className="loading-text">Loading holdings...</p>}

      {error && (
        <div className="error-msg">
          <p>{error}</p>
          <button onClick={() => router.refresh()}>Try again</button>
        </div>
      )}

      {!loading && !error && holdings.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>No holdings found for this account.</p>
      )}

      {!loading && !error && holdings.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Units</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Market Value</th>
              <th style={{ textAlign: 'right' }}>Day Change</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.symbol || h.id}>
                <td style={{ fontWeight: 600 }}>{h.symbol}</td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{h.description || '—'}</td>
                <td style={{ textAlign: 'right' }}>{h.units ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>{fmt(h.price)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(h.marketValue)}</td>
                <td style={{ textAlign: 'right', color: h.dayPnl >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                  {fmtPct(h.dayPnlPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
