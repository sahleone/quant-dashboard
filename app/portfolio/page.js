'use client'

import { useState, useEffect, useCallback } from 'react'
import useAuth from '@/hooks/useAuth'
import { usePortfolio } from '@/context/PortfolioContext'
import { authenticatedGet } from '@/utils/apiClient'
import RefreshButton from '@/components/refreshButton/RefreshButton'
import BarChart from '@/components/charts/BarChart'
import { fmt, fmtPct } from '@/utils/format'

export default function PortfolioPage() {
  const user = useAuth()
  const { selectedAccountId } = usePortfolio()
  const [holdings, setHoldings] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortField, setSortField] = useState('totalValue')
  const [sortDir, setSortDir] = useState('desc')

  const accountQuery = selectedAccountId
    ? `?accountId=${encodeURIComponent(selectedAccountId)}`
    : ''

  const fetchPortfolio = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [holdRes, sumRes] = await Promise.allSettled([
        authenticatedGet('/api/accounts'),
        authenticatedGet(`/api/metrics/portfolio-value${accountQuery}`),
      ])
      if (holdRes.status === 'fulfilled') {
        const payload = holdRes.value.data
        const list = Array.isArray(payload) ? payload : payload?.accounts ?? []
        setHoldings(
          selectedAccountId
            ? list.filter((a) => a.accountId === selectedAccountId)
            : list
        )
      }
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data)
    } catch (err) {
      setError('Could not load portfolio data.')
    } finally {
      setLoading(false)
    }
  }, [accountQuery, selectedAccountId])

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  if (!user) return null

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('desc') }
  }

  const sorted = [...holdings].sort((a, b) => {
    const isNumeric = sortField === 'holdingsCount' || sortField === 'totalValue'
    if (isNumeric) {
      const av = Number(a?.[sortField] ?? 0)
      const bv = Number(b?.[sortField] ?? 0)
      const cmp = av - bv
      return sortDir === 'asc' ? cmp : -cmp
    }
    const av = String(a?.[sortField] ?? '')
    const bv = String(b?.[sortField] ?? '')
    const cmp = av.localeCompare(bv)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const holdingsTotalValue = holdings.reduce((sum, account) => {
    return sum + Number(account?.totalValue ?? 0)
  }, 0)
  const totalValue =
    holdings.length > 0
      ? holdingsTotalValue
      : (summary?.summary?.endValue ?? null)

  const topHoldings = [...holdings].sort((a, b) => (b.totalValue ?? 0) - (a.totalValue ?? 0)).slice(0, 10)
  const chartLabels = topHoldings.map((h) => h.accountName || h.institutionName || '?')
  const chartValues = topHoldings.map((h) => Number(h.totalValue ?? 0))
  const chartColors = ['#6c63ff','#00d4aa','#ffd166','#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ff9f43','#a29bfe','#fd79a8']

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ color: 'var(--color-text-dim)' }}> ↕</span>
    return <span style={{ color: 'var(--color-primary)' }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
  }

  if (loading) return <div className="loading">Loading portfolio...</div>
  if (error) return <div className="page-container"><div className="error-msg">{error}</div></div>

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Portfolio</h2>
          <p>{holdings.length} account{holdings.length !== 1 ? 's' : ''}{totalValue != null && ` · Total: ${fmt(totalValue)}`}</p>
        </div>
        <RefreshButton onRefresh={fetchPortfolio} />
      </div>

      {holdings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No holdings found.</p>
          <p style={{ fontSize: '0.875rem' }}>Go to <strong>Settings → Connections</strong> to link your brokerage accounts.</p>
        </div>
      ) : (
        <>
          {topHoldings.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--color-text-muted)' }}>Top Accounts by Value</h3>
              <BarChart labels={chartLabels} datasets={[{ label: 'Market Value ($)', data: chartValues, backgroundColor: chartColors, borderRadius: 5 }]} height={200} />
            </div>
          )}

          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('accountName')} style={{ cursor: 'pointer' }}>Account<SortIcon field="accountName" /></th>
                  <th>Institution</th>
                  <th onClick={() => handleSort('holdingsCount')} style={{ cursor: 'pointer' }}>Holdings<SortIcon field="holdingsCount" /></th>
                  <th onClick={() => handleSort('totalValue')} style={{ cursor: 'pointer' }}>Total Value<SortIcon field="totalValue" /></th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a, i) => (
                  <tr key={a.accountId || i}>
                    <td style={{ fontWeight: 600 }}>{a.accountName || '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{a.institutionName || '—'}</td>
                    <td>{a.holdingsCount ?? '—'}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(a.totalValue)}</td>
                    <td><span className={a.status === 'open' ? 'positive' : ''}>{a.status || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
