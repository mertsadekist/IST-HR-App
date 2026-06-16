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

const Stepline = () => {
  const [isDark] = useDarkMode();
  const series = [
    {
      data: [34, 44, 54, 21, 12, 43, 33, 23, 66, 66, 58],
    },
  ];
  const options = {
    chart: {
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: "stepline",
    },
    dataLabels: {
      enabled: false,
    },

    yaxis: getYAxisConfig(isDark),
    grid: getGridConfig(isDark),
    legend: {
      labels: {
        colors: isDark
          ? themeConfig.colors.chart_text_dark
          : themeConfig.colors.chart_text_light,
      },
    },
    colors: [themeConfig.colors.primary],
    xaxis: {
      labels: {
        style: {
          colors: isDark
            ? themeConfig.colors.chart_text_dark
            : themeConfig.colors.chart_text_light,
          fontFamily: "Inter",
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    markers: {
      hover: {
        sizeOffset: 4,
      },
    },
  };

  return (
    <div>
      <Chart options={options} series={series} type="line" height="350" />
    </div>
  );
};

export default Stepline;
