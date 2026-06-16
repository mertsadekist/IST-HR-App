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

const Radar = () => {
  const [isDark] = useDarkMode();
  const series = [
    {
      name: "Option A",
      data: [41, 64, 81, 60, 42, 42, 33, 23],
    },
    {
      name: "Option B",
      data: [65, 46, 42, 25, 58, 63, 76, 43],
    },
  ];
  const options = {
    chart: {
      toolbar: {
        show: false,
      },
      dropShadow: {
        enabled: false,
        blur: 8,
        left: 1,
        top: 1,
        opacity: 0.2,
      },
    },
    legend: {
      show: true,
      fontSize: "14px",
      fontFamily: "Inter",
      labels: {
        colors: isDark
          ? themeConfig.colors.chart_text_dark
          : themeConfig.colors.chart_text_light,
      },
    },
    yaxis: {
      show: false,
    },
    colors: [themeConfig.colors.primary, themeConfig.colors.warning],
    xaxis: {
      categories: [
        "Battery",
        "Brand",
        "Camera",
        "Memory",
        "Storage",
        "Display",
        "OS",
        "Price",
      ],
    },
    fill: {
      opacity: [1, 0.8],
    },
    stroke: {
      show: false,
      width: 0,
    },
    markers: {
      size: 0,
    },
    grid: {
      show: false,
    },
  };
  return (
    <div>
      <Chart options={options} series={series} type="radar" height={450} />
    </div>
  );
};

export default Radar;
