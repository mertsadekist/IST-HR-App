import React from "react";
import Chart from "react-apexcharts";
import useDarkMode from "@/hooks/useDarkMode";
import {
  getGridConfig,
  getXAxisConfig,
  getYAxisConfig,
} from "@/utility/appex-chart-options";
import themeConfig from "@/configs/themeConfig";

const BasicArea = ({ height = 350 }) => {
  const [isDark] = useDarkMode();
  const series = [
    {
      data: [90, 70, 85, 60, 80, 70, 90, 75, 60, 80],
    },
  ];
  const options = {
    chart: {
      toolbar: {
        show: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth",
      width: 4,
    },
    colors: [themeConfig.colors.primary],
    tooltip: {
      theme: isDark ? "dark" : "light",
    },
    grid: getGridConfig(isDark),

    yaxis: getYAxisConfig(isDark),
    xaxis: getXAxisConfig(isDark),
  };
  return (
    <div>
      <Chart options={options} series={series} type="line" height={height} />
    </div>
  );
};

export default BasicArea;
