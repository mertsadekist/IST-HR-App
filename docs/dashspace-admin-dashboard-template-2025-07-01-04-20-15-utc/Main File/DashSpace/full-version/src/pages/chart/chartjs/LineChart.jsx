import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { colors, hexToRGB } from "@/mocks/data";
import useDarkMode from "@/hooks/useDarkMode";
import themeConfig from "@/configs/themeConfig";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);
const LineChart = () => {
  const [isDark] = useDarkMode();
  const data = {
    labels: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140],
    datasets: [
      {
        label: " data one",
        data: [
          80, 150, 180, 270, 210, 160, 160, 202, 265, 210, 270, 255, 290, 360,
          375,
        ],
        fill: false,
        backgroundColor: hexToRGB(themeConfig.colors.primary, 1),
        borderColor: themeConfig.colors.primary,
        borderSkipped: "bottom",
        barThickness: 40,
        pointRadius: 1,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 5,
        pointBorderColor: "transparent",
        lineTension: 0.5,
        pointStyle: "circle",
        pointShadowOffsetX: 1,
        pointShadowOffsetY: 1,
        pointShadowBlur: 5,
      },
      {
        label: " data two",
        data: [
          80, 125, 105, 130, 215, 195, 140, 160, 230, 300, 220, 170, 210, 200,
          280,
        ],
        fill: false,
        backgroundColor: hexToRGB(themeConfig.colors.success, 1),
        borderColor: themeConfig.colors.success,
        borderSkipped: "bottom",
        barThickness: 40,
        pointRadius: 1,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 5,
        pointBorderColor: "transparent",
        lineTension: 0.5,
        pointStyle: "circle",
        pointShadowOffsetX: 1,
        pointShadowOffsetY: 1,
        pointShadowBlur: 5,
      },
      {
        label: " data three",
        data: [
          80, 99, 82, 90, 115, 115, 74, 75, 130, 155, 125, 90, 140, 130, 180,
        ],
        fill: false,
        backgroundColor: hexToRGB(themeConfig.colors.warning, 1),
        borderColor: themeConfig.colors.warning,
        borderSkipped: "bottom",
        barThickness: 40,
        pointRadius: 1,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 5,
        pointBorderColor: "transparent",
        lineTension: 0.5,
        pointStyle: "circle",
        pointShadowOffsetX: 1,
        pointShadowOffsetY: 1,
        pointShadowBlur: 5,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
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
      y: {
        stacked: true,
        grid: {
          color: isDark
            ? themeConfig.colors.chart_grid_dark
            : themeConfig.colors.chart_grid_light,
        },
        ticks: {
          color: isDark
            ? themeConfig.colors.chart_text_dark
            : themeConfig.colors.chart_text_light,
        },
      },
      x: {
        grid: {
          color: isDark
            ? themeConfig.colors.chart_grid_dark
            : themeConfig.colors.chart_grid_light,
        },

        ticks: {
          color: isDark
            ? themeConfig.colors.chart_text_dark
            : themeConfig.colors.chart_text_light,
        },
      },
    },
  };
  return (
    <div>
      <Line options={options} data={data} height={350} />
    </div>
  );
};

export default LineChart;
