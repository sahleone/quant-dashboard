'use client'

import { useState, useEffect, useCallback } from 'react'
import useAuth from '@/hooks/useAuth'
import { usePortfolio } from '@/context/PortfolioContext'
import { authenticatedGet } from '@/utils/apiClient'
import BarChart from '@/components/charts/BarChart'
import RefreshButton from '@/components/refreshButton/RefreshButton'
import { fmt } from '@/utils/format'

function fmtDate(dateStr) {
  if (!dateStr) return '\u2014'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function DividendsPage() {
  const user = useAuth()
  const { selectedAccountId } = usePortfolio()
  const [dividends, setDividends] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('upcoming')

  const accountQuery = selectedAccountId
    ? `?accountId=${encodeURIComponent(selectedAccountId)}`
    : ''

  const fetchDividends = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedGet(`/api/accounts/dividends/by-month${accountQuery}`)
      const data = res.data

      if (Array.isArray(data)) {
        setDividends(data)
      } else {
        setDividends(data.dividends || data.history || [])
        setSummary(data.summary || null)
      }
    } catch (err) {
      console.error('Dividends fetch error:', err)
      setError('Could not load dividend data.')
    } finally {
      setLoading(false)
    }
  }, [accountQuery])

  useEffect(() => {
    fetchDividends()
  }, [fetchDividends])

  const today = new Date()
  const upcoming = dividends.filter((d) => new Date(d.payDate || d.exDate) >= today)
  const history = dividends.filter((d) => new Date(d.payDate || d.exDate) < today)

  const monthlyMap = {}
  history.forEach((d) => {
    const date = new Date(d.payDate || d.exDate)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = (monthlyMap[key] || 0) + Number(d.amount || d.totalAmount || 0)
  })

  const sortedMonths = Object.keys(monthlyMap).sort().slice(-12)
  const monthlyLabels = sortedMonths.map((k) => {
    const [y, m] = k.split('-')
    return new Date(y, m - 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  })
  const monthlyValues = sortedMonths.map((k) => monthlyMap[k])

  const annualIncome = monthlyValues.reduce((sum, v) => sum + v, 0)
  const displayed = activeTab === 'upcoming' ? upcoming : history

  if (!user) return null
  if (loading) return <div className="loading">Loading dividends...</div>
  if (error) return <div className="page-container"><div className="error-msg">{error}</div></div>

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Dividends</h2>
          <p>Track income from your dividend-paying holdings</p>
        </div>
        <RefreshButton onRefresh={fetchDividends} />
      </div>

      {}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <div className="label">Annual Income (TTM)</div>
          <div className="value">{fmt(annualIncome > 0 ? annualIncome : summary?.annualIncome)}</div>
        </div>
        <div className="metric-card">
          <div className="label">Upcoming Payments</div>
          <div className="value">{upcoming.length}</div>
        </div>
        <div className="metric-card">
          <div className="label">Portfolio Yield</div>
          <div className="value">
            {summary?.yield ? `${Number(summary.yield).toFixed(2)}%` : '\u2014'}
          </div>
        </div>
      </div>

      {}
      {sortedMonths.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--color-text-muted)' }}>
            Monthly Dividend Income (Last 12 Months)
          </h3>
          <BarChart
            labels={monthlyLabels}
            datasets={[{
              label: 'Income ($)',
              data: monthlyValues,
              backgroundColor: 'rgba(0, 212, 170, 0.7)',
              borderColor: '#00d4aa',
              borderWidth: 1,
              borderRadius: 4,
            }]}
            height={220}
          />
        </div>
      )}

      {}
      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.25rem', paddingBottom: '0' }}>
          {['upcoming', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab ? 'var(--color-primary)' : 'transparent'}`,
                color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                padding: '0.65rem 1.1rem',
                marginBottom: '-1px',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'color 0.2s',
              }}
            >
              {tab === 'upcoming' ? `Upcoming (${upcoming.length})` : `History (${history.length})`}
            </button>
          ))}
        </div>

        {displayed.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', padding: '1rem 0', fontSize: '0.9rem' }}>
            {activeTab === 'upcoming' ? 'No upcoming dividends found.' : 'No dividend history found.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Ex-Date</th>
                  <th>Pay Date</th>
                  <th>Amount / Share</th>
                  <th>Total Payout</th>
                  <th>Frequency</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((d, i) => (
                  <tr key={d._id || `${d.symbol}-${i}`}>
                    <td>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                        {d.symbol || d.ticker || '\u2014'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {fmtDate(d.exDate || d.exDividendDate)}
                    </td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {fmtDate(d.payDate || d.paymentDate)}
                    </td>
                    <td>{fmt(d.amountPerShare || d.dividendPerShare || d.rate)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
                      {fmt(d.totalAmount || d.amount)}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                      {d.frequency || '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
