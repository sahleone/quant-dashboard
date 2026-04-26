'use client'

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler
);

function LineGraph({ labels = [], datasets = [], title = "", height = 300 }) {
  const data = { labels, datasets };

  const options = {
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
        ticks: { color: "#555c7a", maxRotation: 45, font: { size: 11 } },
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
      <Line data={data} options={options} />
    </div>
  );
}

export default LineGraph;
