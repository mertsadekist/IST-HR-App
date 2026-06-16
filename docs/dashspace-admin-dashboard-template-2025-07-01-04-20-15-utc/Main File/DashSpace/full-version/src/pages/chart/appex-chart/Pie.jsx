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

const Pie = () => {
  const [isDark] = useDarkMode();
  const series = [44, 55, 13, 43, 22];

  const options = {
    labels: ["Apple", "Orange", "Pineapple", "Grab", "Nasu"],
    dataLabels: {
      enabled: true,
    },

    colors: [
      themeConfig.colors.primary,
      themeConfig.colors.info,
      themeConfig.colors.success,
      themeConfig.colors.warning,
      themeConfig.colors.danger,
    ],
    legend: {
      position: "bottom",
      fontSize: "16px",
      fontFamily: "Inter",
      fontWeight: 400,
      labels: {
        colors: isDark
          ? themeConfig.colors.chart_text_dark
          : themeConfig.colors.chart_text_light,
      },
      markers: {
        width: 6,
        height: 6,
        offsetY: -1,
        offsetX: -5,
        radius: 12,
      },
      itemMargin: {
        horizontal: 10,
        vertical: 0,
      },
    },

    responsive: [
      {
        breakpoint: 480,
        options: {
          legend: {
            position: "bottom",
          },
        },
      },
    ],
  };

  return (
    <div>
      <Chart options={options} series={series} type="pie" height="450" />
    </div>
  );
};

export default Pie;
