import React from "react";
import Chart from "react-apexcharts";
import useDarkMode from "@/hooks/useDarkMode";
import {
  getGridConfig,
  getXAxisConfig,
  getYAxisConfig,
} from "@/utility/appex-chart-options";
import themeConfig from "@/configs/themeConfig";

const LineChartData = ({ height = 350 }) => {
  const [isDark] = useDarkMode();
  const series = [
    {
      name: "High - 2023",
      data: [90, 70, 85, 60, 80, 70, 90, 75, 60, 80],
    },
    {
      name: "Low - 2023",
      data: [100, 80, 70, 65, 85, 80, 95, 70, 75, 85],
    },
  ];
  const options = {
    chart: {
      toolbar: {
        show: false,
      },
      dropShadow: {
        enabled: true,
        color: "#000",
        top: 18,
        left: 7,
        blur: 10,
        opacity: 0.2,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
    },
    colors: [themeConfig.colors.primary, themeConfig.colors.success],
    tooltip: {
      theme: isDark ? "dark" : "light",
    },
    grid: getGridConfig(isDark),

    yaxis: getYAxisConfig(isDark),
    xaxis: getXAxisConfig(isDark),
    markers: {
      size: 5,
    },
  };
  return (
    <div>
      <Chart options={options} series={series} type="line" height={height} />
    </div>
  );
};

export default LineChartData;
