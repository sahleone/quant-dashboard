'use client'

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

function DoughnutChart({ labels = [], values = [], colors = [], height = 220 }) {
  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: colors,
      borderColor: '#1a1d27',
      borderWidth: 2,
      hoverBorderColor: '#e8eaf0',
      hoverBorderWidth: 2,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1d27',
        titleColor: '#e8eaf0',
        bodyColor: '#8b90a8',
        borderColor: '#2e3248',
        borderWidth: 1,
        callbacks: {
          label(ctx) {
            const total = ctx.dataset.data.reduce((s, v) => s + v, 0)
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : '0.0'
            return ` ${ctx.label}: ${pct}%`
          },
        },
      },
    },
  }

  return (
    <div style={{ height, position: 'relative' }}>
      <Doughnut data={data} options={options} />
    </div>
  )
}

export default DoughnutChart
