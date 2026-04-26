'use client'

import { useState, useEffect, useCallback } from 'react'
import useAuth from '@/hooks/useAuth'
import { usePortfolio } from '@/context/PortfolioContext'
import { authenticatedGet } from '@/utils/apiClient'
import BarChart from '@/components/charts/BarChart'
import DoughnutChart from '@/components/charts/DoughnutChart'
import TreemapChart from '@/components/charts/TreemapChart'
import RefreshButton from '@/components/refreshButton/RefreshButton'
import styles from './asset-allocation.module.css'

const CHART_COLORS = [
  '#6c63ff', '#00d4aa', '#ffd166', '#ff6b6b', '#4ecdc4',
  '#45b7d1', '#96ceb4', '#ff9f43', '#a29bfe', '#fd79a8',
  '#6ab04c', '#e17055', '#0984e3', '#d63031', '#00cec9',
]

function AllocationSection({ title, data, keyField, valueField }) {
  if (!data || data.length === 0) {
    return (
      <div className={`card ${styles.section}`}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <p className={styles.noData}>No data available.</p>
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => (b[valueField] ?? 0) - (a[valueField] ?? 0))
  const labels = sorted.map((d) => d[keyField] || 'Other')
  const values = sorted.map((d) => Number(d[valueField] ?? 0))
  const total = values.reduce((sum, v) => sum + v, 0)
  const colors = CHART_COLORS.slice(0, labels.length)

  return (
    <div className={`card ${styles.section}`}>
      <h3 className={styles.sectionTitle}>{title}</h3>

      <div className={styles.sectionGrid}>
        {}
        <DoughnutChart labels={labels} values={values} colors={colors} height={180} />

        {}
        <BarChart
          labels={labels}
          datasets={[{
            label: 'Allocation (%)',
            data: values,
            backgroundColor: colors,
            borderRadius: 4,
          }]}
          height={180}
          horizontal
        />

        {}
        <div className={styles.legend}>
          {sorted.map((item, i) => {

            const pct = Number(item[valueField] ?? 0).toFixed(1)
            return (
              <div key={item[keyField] || i} className={styles.legendRow}>
                <span
                  className={styles.legendDot}
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className={styles.legendLabel}>
                  {item[keyField] || 'Other'}
                </span>
                <span className={styles.legendPct}>{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const TREEMAP_VIEWS = [
  { key: 'assetClass', label: 'Asset Class' },
  { key: 'sector', label: 'Sector' },
  { key: 'industry', label: 'Industry' },
  { key: 'exchange', label: 'Exchange' },
]

function TreemapSection({ byAssetClass, bySector, byIndustry, byExchange }) {
  const [activeView, setActiveView] = useState('assetClass')

  const dataSets = {
    assetClass: (byAssetClass || []).map((d) => ({ label: d.assetClass || 'Other', value: d.percentage ?? 0 })),
    sector: (bySector || []).map((d) => ({ label: d.sector || 'Other', value: d.percentage ?? 0 })),
    industry: (byIndustry || []).map((d) => ({ label: d.industry || 'Other', value: d.percentage ?? 0 })),
    exchange: (byExchange || []).map((d) => ({ label: d.exchange || 'Other', value: d.percentage ?? 0 })),
  }

  const items = dataSets[activeView]
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  if (items.length === 0) return null

  return (
    <div className={`card ${styles.treemapSection}`}>
      <h3 className={styles.treemapTitle}>Portfolio Treemap</h3>
      <div className={styles.treemapTabs}>
        {TREEMAP_VIEWS.map((v) => (
          <button
            key={v.key}
            className={`${styles.treemapTab} ${activeView === v.key ? styles.treemapTabActive : ''}`}
            onClick={() => setActiveView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <TreemapChart items={items} colors={CHART_COLORS} height={280} />
    </div>
  )
}

export default function AssetAllocationPage() {
  const user = useAuth()
  const { selectedAccountId } = usePortfolio()
  const [allocation, setAllocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const accountQuery = selectedAccountId
    ? `?accountId=${encodeURIComponent(selectedAccountId)}`
    : ''

  const fetchAllocation = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authenticatedGet(`/api/accounts/holdings${accountQuery}`)
      setAllocation(res.data)
    } catch (err) {
      console.error('Asset allocation fetch error:', err)
      setError('Could not load allocation data.')
    } finally {
      setLoading(false)
    }
  }, [accountQuery])

  useEffect(() => {
    fetchAllocation()
  }, [fetchAllocation])

  if (!user) return null
  if (loading) return <div className="loading">Loading allocation...</div>
  if (error) return <div className="page-container"><div className="error-msg">{error}</div></div>

  const byAssetClass = allocation?.byAssetClass ?? allocation?.assetClass ?? allocation ?? []
  const bySector = allocation?.bySector ?? allocation?.sector ?? []
  const byIndustry = allocation?.byIndustry ?? []
  const rawExchange = allocation?.byExchange ?? allocation?.byGeography ?? allocation?.geography ?? []
  const byExchange = Array.isArray(rawExchange)
    ? rawExchange.map((row) =>
        row?.exchange != null
          ? row
          : { ...row, exchange: row?.country ?? 'Other' }
      )
    : []

  return (
    <div className="page-container">
      <div className={`page-header ${styles.header}`}>
        <div>
          <h2>Asset Allocation</h2>
          <p>How your portfolio is divided across categories</p>
        </div>
        <RefreshButton onRefresh={fetchAllocation} />
      </div>

      <TreemapSection
        byAssetClass={Array.isArray(byAssetClass) ? byAssetClass : []}
        bySector={Array.isArray(bySector) ? bySector : []}
        byIndustry={Array.isArray(byIndustry) ? byIndustry : []}
        byExchange={byExchange}
      />

      <AllocationSection
        title="By Asset Class"
        data={Array.isArray(byAssetClass) ? byAssetClass : []}
        keyField="assetClass"
        valueField="percentage"
      />

      <AllocationSection
        title="By Sector"
        data={Array.isArray(bySector) ? bySector : []}
        keyField="sector"
        valueField="percentage"
      />

      <AllocationSection
        title="By Industry"
        data={Array.isArray(byIndustry) ? byIndustry : []}
        keyField="industry"
        valueField="percentage"
      />

      <AllocationSection
        title="By Exchange"
        data={byExchange}
        keyField="exchange"
        valueField="percentage"
      />

      {!allocation?.byAssetClass && !allocation?.assetClass && Array.isArray(allocation) && (
        <AllocationSection
          title="Allocation Breakdown"
          data={allocation}
          keyField="label"
          valueField="percentage"
        />
      )}
    </div>
  )
}
