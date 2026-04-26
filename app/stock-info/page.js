'use client'

import { useState } from 'react'
import useAuth from '@/hooks/useAuth'
import { authenticatedGet } from '@/utils/apiClient'
import styles from './stock-info.module.css'

function fmtNumber(val) {
  if (val == null) return '—'
  return Number(val).toLocaleString()
}

function fmtMarketCap(val) {
  if (val == null) return '—'
  const n = Number(val)
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${fmtNumber(n)}`
}

function formatAddress(addr) {
  if (!addr) return null
  const parts = []
  if (addr.address1) parts.push(addr.address1)
  if (addr.city) parts.push(addr.city)
  if (addr.state) parts.push(addr.state)
  if (addr.postalCode) parts.push(addr.postalCode)
  if (parts.length === 0) return null
  return parts.join(', ')
}

export default function StockInfoPage() {
  const user = useAuth()
  const [query, setQuery] = useState('')
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!user) return null

  const handleSearch = async (e) => {
    e.preventDefault()
    const ticker = query.trim().toUpperCase()
    if (!ticker) return

    setLoading(true)
    setError(null)
    setOverview(null)

    try {
      const res = await authenticatedGet(`/api/ticker-overview/${encodeURIComponent(ticker)}`)
      setOverview(res.data)
    } catch (err) {
      const status = err?.status
      if (status === 404) {
        setError(`No data found for "${ticker}".`)
      } else {
        setError('Failed to fetch ticker data')
      }
    } finally {
      setLoading(false)
    }
  }

  const addr = overview ? formatAddress(overview.address) : null

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Stock Info</h2>
        <p>Look up company fundamentals by ticker symbol</p>
      </div>

      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Enter ticker (e.g. AAPL)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={20}
        />
        <button type="submit" className={`btn-primary ${styles.searchBtn}`} disabled={loading || !query.trim()}>
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      {overview && (
        <div className={`card ${styles.profileCard}`}>
          <div className={styles.profileHeader}>
            <div>
              <div className={styles.profileName}>{overview.name || overview.ticker}</div>
              <span className={styles.profileTicker}>{overview.ticker}</span>
              {overview.primaryExchange && (
                <span className={styles.profileExchange}> · {overview.primaryExchange}</span>
              )}
              {overview.active != null && (
                <>
                  {' '}
                  <span className={`${styles.activeStatus} ${overview.active ? styles.activeTrue : styles.activeFalse}`}>
                    {overview.active ? 'Active' : 'Delisted'}
                  </span>
                </>
              )}
            </div>
          </div>

          {overview.description && (
            <p className={styles.description}>{overview.description}</p>
          )}

          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Market Cap</span>
              <span className={styles.statValue}>{fmtMarketCap(overview.marketCap)}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>Industry (SIC)</span>
              <span className={styles.statValue}>{overview.sicDescription || '—'}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>SIC Code</span>
              <span className={styles.statValue}>{overview.sicCode || '—'}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>Employees</span>
              <span className={styles.statValue}>{fmtNumber(overview.totalEmployees)}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>IPO Date</span>
              <span className={styles.statValue}>{overview.listDate || '—'}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>Currency</span>
              <span className={styles.statValue}>{overview.currencyName || '—'}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>Shares Outstanding</span>
              <span className={styles.statValue}>{fmtNumber(overview.weightedSharesOutstanding)}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>CIK</span>
              <span className={styles.statValue}>{overview.cik || '—'}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>Composite FIGI</span>
              <span className={styles.statValue}>{overview.compositeFigi || '—'}</span>
            </div>

            {overview.homepageUrl && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Website</span>
                <a
                  href={overview.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.statLink}
                >
                  {overview.homepageUrl.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}

            {addr && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Headquarters</span>
                <span className={styles.addressLine}>{addr}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
