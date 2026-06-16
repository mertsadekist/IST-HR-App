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
const OrderChart = ({ height = 220 }) => {
  const [isDark] = useDarkMode();
  const series = [44, 55, 41];

  const options = {
    labels: ["success", "Return", "Cancel"],
    dataLabels: {
      enabled: false,
    },

    colors: [
      themeConfig.colors.primary,
      themeConfig.colors.success,
      themeConfig.colors.danger,
    ],
    legend: {
      position: "bottom",
      fontSize: "14px",
      fontFamily: "Inter",
      fontWeight: 400,
      labels: {
        colors: isDark
          ? themeConfig.colors.chart_text_dark
          : themeConfig.colors.chart_text_light,
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: "10px",
              fontWeight: "bold",
              fontFamily: "Inter",
              color: isDark
                ? themeConfig.colors.chart_text_dark
                : themeConfig.colors.chart_text_light,
            },
            value: {
              show: true,
              fontFamily: "Inter",
              color: isDark
                ? themeConfig.colors.chart_text_dark
                : themeConfig.colors.chart_text_light,
              formatter(val) {
                // eslint-disable-next-line radix
                return `${parseInt(val)}%`;
              },
            },
            total: {
              show: true,
              fontSize: "16px",
              color: isDark
                ? themeConfig.colors.chart_text_dark
                : themeConfig.colors.chart_text_light,
              label: "Ratio",
            },
          },
        },
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
      <Chart options={options} series={series} type="donut" height={height} />
    </div>
  );
};

export default OrderChart;
