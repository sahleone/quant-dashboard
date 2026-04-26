'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  Tooltip,
} from 'chart.js'
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap'
import { Chart } from 'react-chartjs-2'

ChartJS.register(TreemapController, TreemapElement, Tooltip)

function TreemapChart({ items = [], colors = [], height = 280 }) {
  const tree = useMemo(
    () => items.map((d) => ({ label: d.label, value: d.value })),
    [items]
  )

  const data = {
    datasets: [{
      tree,
      key: 'value',
      labels: { display: true, font: { size: 12, weight: '600' }, color: '#e8eaf0' },
      backgroundColor(ctx) {
        if (ctx.type !== 'data') return 'transparent'
        return colors[ctx.dataIndex % colors.length] ?? '#6c63ff'
      },
      borderColor: '#1a1d27',
      borderWidth: 2,
      spacing: 1,
      captions: { display: false },
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1d27',
        titleColor: '#e8eaf0',
        bodyColor: '#8b90a8',
        borderColor: '#2e3248',
        borderWidth: 1,
        callbacks: {
          title(tooltipItems) {
            const item = tooltipItems[0]
            return item?.raw?._data?.label ?? ''
          },
          label(ctx) {
            const total = tree.reduce((s, t) => s + t.value, 0)
            const val = ctx.raw?._data?.value ?? 0
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0'
            return ` ${pct}%`
          },
        },
      },
    },
  }

  return (
    <div style={{ height }}>
      <Chart type="treemap" data={data} options={options} />
    </div>
  )
}

export default TreemapChart
