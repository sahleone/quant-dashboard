'use client'

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function BarChart({ labels = [], datasets = [], title = "", height = 300, horizontal = false }) {
  const data = { labels, datasets };

  const options = {
    indexAxis: horizontal ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#8b90a8", font: { size: 12 } },
      },
      title: {
        display: !!title,
        text: title,
        color: "#e8eaf0",
        font: { size: 14, weight: "600" },
        padding: { bottom: 16 },
      },
      tooltip: {
        backgroundColor: "#1a1d27",
        titleColor: "#e8eaf0",
        bodyColor: "#8b90a8",
        borderColor: "#2e3248",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: "#555c7a", font: { size: 11 } },
        grid: { color: "#1e2235" },
      },
      y: {
        ticks: { color: "#555c7a", font: { size: 11 } },
        grid: { color: "#1e2235" },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
}

export default BarChart;
