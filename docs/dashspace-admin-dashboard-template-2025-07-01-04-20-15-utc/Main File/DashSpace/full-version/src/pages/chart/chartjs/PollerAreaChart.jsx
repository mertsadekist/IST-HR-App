import React from "react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { PolarArea } from "react-chartjs-2";
import { colors, hexToRGB } from "@/mocks/data";
import useDarkMode from "@/hooks/useDarkMode";
import themeConfig from "@/configs/themeConfig";
ChartJS.register(RadialLinearScale, ArcElement, Tooltip, Legend);
const PollerAreaChart = () => {
  const [isDark] = useDarkMode();
  const data = {
    labels: ["primary", "success", "yellow-400", "info", "danger"],
    datasets: [
      {
        label: "My First Dataset",
        data: [11, 16, 7, 3, 14],
        backgroundColor: [
          themeConfig.colors.primary,
          themeConfig.colors.success,
          themeConfig.colors.info,
          themeConfig.colors.warning,
          themeConfig.colors.danger,
        ],
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: isDark
            ? themeConfig.colors.chart_text_dark
            : themeConfig.colors.chart_text_light,
        },
      },
    },
    scales: {
      r: {
        ticks: {
          color: isDark ? "#475569" : "#475569",
        },
        grid: {
          color: isDark ? "#334155" : "#e2e8f0",
        },
        pointLabels: {
          color: isDark ? "#cbd5e1" : "#475569",
        },
        angleLines: {
          color: isDark ? "#334155" : "#e2e8f0",
        },
      },
    },
    maintainAspectRatio: false,
  };
  return (
    <div>
      <PolarArea options={options} data={data} height={350} />
    </div>
  );
};

export default PollerAreaChart;
