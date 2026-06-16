import React from "react";
import Chart from "react-apexcharts";
import useDarkMode from "@/hooks/useDarkMode";
import useWidth from "@/hooks/useWidth";

import {
  getGridConfig,
  getXAxisConfig,
  getYAxisConfig,
  getLabel,
} from "@/utility/appex-chart-options";
import themeConfig from "@/configs/themeConfig";
const Radialbars = () => {
  const [isDark] = useDarkMode();
  const { width, breakpoints } = useWidth();
  const series = [44, 55, 67, 83];
  const options = {
    chart: {
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      radialBar: {
        dataLabels: {
          name: {
            fontSize: "22px",
            color: isDark
              ? themeConfig.colors.chart_text_dark
              : themeConfig.colors.chart_text_light,
          },
          value: {
            fontSize: "16px",
            color: isDark
              ? themeConfig.colors.chart_text_dark
              : themeConfig.colors.chart_text_light,
          },
          total: {
            show: true,
            label: "Total",
            color: isDark
              ? themeConfig.colors.chart_text_dark
              : themeConfig.colors.chart_text_light,
            formatter: function () {
              return 249;
            },
          },
        },
        track: {
          background: "#E2E8F0",
          strokeWidth: "97%",
        },
      },
    },
    labels: ["A", "B", "C", "D"],
    colors: [
      themeConfig.colors.primary,
      themeConfig.colors.info,
      themeConfig.colors.warning,
      themeConfig.colors.danger,
    ],
  };

  return (
    <div>
      <Chart
        options={options}
        series={series}
        type="radialBar"
        height={width > breakpoints.md ? 450 : 250}
      />
    </div>
  );
};

export default Radialbars;
