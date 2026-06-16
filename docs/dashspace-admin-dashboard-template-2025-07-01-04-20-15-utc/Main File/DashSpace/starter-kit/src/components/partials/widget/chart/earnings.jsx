import React from "react";
import themeConfig from "@/configs/themeConfig";
import Chart from "react-apexcharts";
import useDarkMode from "@/hooks/useDarkMode";

const Earnings = ({ height = 335 }) => {
  const [isDark] = useDarkMode();
  const series = [30, 70];

  const options = {
    labels: ["Sent", "Opend"],
    dataLabels: {
      enabled: true,
    },

    colors: [themeConfig.colors.warning, themeConfig.colors.primary],
    legend: {
      position: "bottom",
      fontSize: "12px",
      fontFamily: "Inter",
      fontWeight: 400,
      labels: {
        colors: isDark ? "#CBD5E1" : "#475569",
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
    <>
      <Chart options={options} series={series} type="pie" height={height} />
    </>
  );
};

export default Earnings;
