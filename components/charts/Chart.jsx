'use client'

import { useState, useEffect, useMemo } from 'react'
import { authenticatedGet } from '@/utils/apiClient'
import LineGraph from '@/components/charts/LineGraph'

function normalizeSeries(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((d) => ({
    date: d.date,
    value: Number(d.value ?? d.totalValue ?? 0),
  }))
}

function Chart({ data: propData, accountId = null }) {
  const [history, setHistory] = useState(() =>
    propData !== undefined ? normalizeSeries(propData) : null
  )
  const [loading, setLoading] = useState(propData === undefined)
  const [error, setError] = useState(null)

  const accountQuery = useMemo(() => {
    if (!accountId) return ''
    return `?accountId=${encodeURIComponent(accountId)}`
  }, [accountId])

  useEffect(() => {
    if (propData !== undefined) {
      setHistory(normalizeSeries(propData))
      setLoading(false)
      return
    }

    let cancelled = false
    const fetchHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await authenticatedGet(`/api/metrics/timeseries${accountQuery}`)
        const body = res.data
        const rows = Array.isArray(body?.data) ? body.data : []
        if (!cancelled) setHistory(normalizeSeries(rows))
      } catch (err) {
        console.error('Chart fetch error:', err)
        if (!cancelled) setError('Could not load portfolio history.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchHistory()
    return () => {
      cancelled = true
    }
  }, [propData, accountQuery])

  if (loading) return <div className="loading">Loading chart...</div>
  if (error) return <div className="error-msg">{error}</div>
  if (!history || history.length === 0) {
    return (
      <div className="loading" style={{ color: '#555c7a' }}>
        No historical data yet. Connect a brokerage and refresh.
      </div>
    )
  }

  const labels = history.map((d) => d.date)
  const values = history.map((d) => d.value)

  const datasets = [
    {
      label: 'Portfolio Value ($)',
      data: values,
      borderColor: '#6c63ff',
      backgroundColor: 'rgba(108, 99, 255, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
    },
  ]

  return <LineGraph labels={labels} datasets={datasets} height={320} />
}

export default Chart
