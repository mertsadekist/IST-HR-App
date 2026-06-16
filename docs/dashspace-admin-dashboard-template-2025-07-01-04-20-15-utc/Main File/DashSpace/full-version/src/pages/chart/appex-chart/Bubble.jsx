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

const Bubble = () => {
  const [isDark] = useDarkMode();
  function generateData(baseval, count, yrange) {
    var i = 0;
    var series = [];
    while (i < count) {
      //var x =Math.floor(Math.random() * (750 - 1 + 1)) + 1;;
      var y =
        Math.floor(Math.random() * (yrange.max - yrange.min + 1)) + yrange.min;
      var z = Math.floor(Math.random() * (75 - 15 + 1)) + 15;

      series.push([baseval, y, z]);
      baseval += 86400000;
      i++;
    }
    return series;
  }
  const series = [
    {
      name: "Product1",
      data: generateData(new Date("11 Feb 2017 GMT").getTime(), 20, {
        min: 10,
        max: 60,
      }),
    },
    {
      name: "Product2",
      data: generateData(new Date("11 Feb 2017 GMT").getTime(), 20, {
        min: 10,
        max: 60,
      }),
    },
    {
      name: "Product3",
      data: generateData(new Date("11 Feb 2017 GMT").getTime(), 20, {
        min: 10,
        max: 60,
      }),
    },
    {
      name: "Product4",
      data: generateData(new Date("11 Feb 2017 GMT").getTime(), 20, {
        min: 10,
        max: 60,
      }),
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

    fill: {
      type: "gradient",
    },
    legend: {
      labels: {
        colors: isDark
          ? themeConfig.colors.chart_text_dark
          : themeConfig.colors.chart_text_light,
      },
    },

    xaxis: {
      tickAmount: 12,
      type: "datetime",

      labels: {
        rotate: 0,
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
    grid: getGridConfig(isDark),

    yaxis: {
      max: 70,
      labels: getLabel(isDark),
    },
    theme: {
      palette: "palette2",
    },
    colors: [
      themeConfig.colors.primary,
      themeConfig.colors.info,
      themeConfig.colors.success,
      themeConfig.colors.warning,
    ],
  };
  return (
    <div>
      <Chart options={options} series={series} type="bubble" height="350" />
    </div>
  );
};

export default Bubble;
