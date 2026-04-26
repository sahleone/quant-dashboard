'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import useAuth from '@/hooks/useAuth'
import { usePortfolio } from '@/context/PortfolioContext'
import { authenticatedGet } from '@/utils/apiClient'
import Chart from '@/components/charts/Chart'
import TabPanel from '@/components/tabPanel/TabPanel'
import RefreshButton from '@/components/refreshButton/RefreshButton'
import { fmt, fmtPct } from '@/utils/format'

function MetricCard({ label, value, sub, colorClass }) {
  return (
    <div className="metric-card">
      <div className="label">{label}</div>
      <div className={`value ${colorClass || ''}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const user = useAuth()
  const { selectedAccountId } = usePortfolio()
  const [portfolioValue, setPortfolioValue] = useState(null)
  const [performance, setPerformance] = useState(null)
  const [risk, setRisk] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const accountQuery = useMemo(() => {
    if (!selectedAccountId) return ''
    return `?accountId=${encodeURIComponent(selectedAccountId)}`
  }, [selectedAccountId])

  const chartSeries = useMemo(
    () =>
      (portfolioValue?.points ?? []).map((p) => ({
        date: p.date,
        value: p.totalValue,
      })),
    [portfolioValue]
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [valueRes, perfRes, riskRes] = await Promise.allSettled([
        authenticatedGet(`/api/metrics/portfolio-value${accountQuery}`),
        authenticatedGet(`/api/metrics/performance${accountQuery}`),
        authenticatedGet(`/api/metrics/risk${accountQuery}`),
      ])

      if (valueRes.status === 'fulfilled') setPortfolioValue(valueRes.value.data)
      if (perfRes.status === 'fulfilled') setPerformance(perfRes.value.data)
      if (riskRes.status === 'fulfilled') setRisk(riskRes.value.data)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [accountQuery])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  if (!user) return null

  const buildPerformanceTab = () => {
    if (!performance) return <div className="loading">No performance data.</div>
    return (
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <MetricCard label="Total Return" value={fmtPct(performance.returns?.totalReturn)} colorClass={Number(performance.returns?.totalReturn) >= 0 ? 'positive' : 'negative'} />
        <MetricCard label="CAGR" value={fmtPct(performance.returns?.cagr)} sub="Annualized" />
        <MetricCard label="Sharpe Ratio" value={performance.sharpe != null ? Number(performance.sharpe).toFixed(2) : '—'} sub="Risk-adjusted return" />
        <MetricCard label="Max Drawdown" value={fmtPct(performance.maxDrawdown)} sub="Largest peak-to-trough" colorClass="negative" />
        <MetricCard label="Sortino" value={performance.sortino != null ? Number(performance.sortino).toFixed(2) : '—'} />
        <MetricCard label="Beta" value={performance.beta != null ? Number(performance.beta).toFixed(2) : '—'} sub="vs benchmark" />
      </div>
    )
  }

  const buildRiskTab = () => {
    if (!risk) return <div className="loading">No risk data.</div>
    return (
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <MetricCard label="Portfolio Beta" value={risk.beta != null ? Number(risk.beta).toFixed(2) : '—'} sub="vs S&P 500" />
        <MetricCard label="Volatility (Ann.)" value={fmtPct(risk.volatility)} sub="Standard deviation" />
        <MetricCard label="Value at Risk (95%)" value={fmtPct(risk.var95)} sub="Daily VaR" colorClass="negative" />
      </div>
    )
  }

  if (loading) return <div className="loading">Loading dashboard...</div>
  if (error) return <div className="page-container"><div className="error-msg">{error}</div></div>

  const totalValue = portfolioValue?.summary?.endValue ?? null
  const tabs = [
    { label: 'Performance', content: buildPerformanceTab() },
    { label: 'Risk', content: buildRiskTab() },
  ]

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Dashboard</h2>
          <p>Your portfolio at a glance</p>
        </div>
        <RefreshButton onRefresh={fetchAll} />
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-2) 100%)' }}>
        <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Total Portfolio Value</p>
        <p style={{ fontSize: '2.75rem', fontWeight: 700, lineHeight: 1 }}>{fmt(totalValue)}</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--color-text-muted)' }}>Portfolio Value Over Time</h3>
        <Chart data={chartSeries} accountId={selectedAccountId} />
      </div>

      <div className="card">
        <TabPanel tabs={tabs} />
      </div>
    </div>
  )
}
