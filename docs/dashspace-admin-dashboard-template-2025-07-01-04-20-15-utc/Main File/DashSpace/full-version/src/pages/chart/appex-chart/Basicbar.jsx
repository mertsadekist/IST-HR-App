import React from "react";
import Chart from "react-apexcharts";
import useDarkMode from "@/hooks/useDarkMode";
import {
  getGridConfig,
  getXAxisConfig,
  getYAxisConfig,
  getLabel,
} from "@/utility/appex-chart-options";
import themeConfig from "@/configs/themeConfig";

const BasicBar = () => {
  const [isDark] = useDarkMode();
  const series = [
    {
      data: [400, 430, 448, 470, 540, 580, 690, 1100, 1200, 1380],
    },
  ];
  const options = {
    chart: {
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
      },
    },
    dataLabels: {
      enabled: false,
    },
    yaxis: {
      labels: getLabel(isDark),
    },
    grid: getGridConfig(isDark),
    xaxis: {
      categories: [
        "South Korea",
        "Canada",
        "United Kingdom",
        "Netherlands",
        "Italy",
        "France",
        "Japan",
        "United States",
        "China",
        "Germany",
      ],
      labels: getLabel(isDark),
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    colors: [themeConfig.colors.primary],
  };
  return (
    <div>
      <Chart options={options} series={series} type="bar" height="350" />
    </div>
  );
};

export default BasicBar;
