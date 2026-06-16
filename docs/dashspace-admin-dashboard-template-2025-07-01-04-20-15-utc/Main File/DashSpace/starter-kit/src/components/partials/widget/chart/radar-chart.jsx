import React from "react";
import Chart from "react-apexcharts";
import useDarkMode from "@/hooks/useDarkMode";
import themeConfig from "@/configs/themeConfig";
const RadarChart = ({ height = 340 }) => {
  const [isDark] = useDarkMode();
  const series = [83];
  const options = {
    chart: {
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      radialBar: {
        size: 200,
        offsetY: -20,
        startAngle: -180,
        endAngle: 150,
        hollow: {
          size: "60%",
        },

        track: {
          background: "#fff",
          strokeWidth: "100%",
        },
        dataLabels: {
          name: {
            fontSize: "22px",
            color: isDark ? "#E2E8F0" : "#475569",
          },
          value: {
            fontSize: "32px",
            offsetY: 30,
            fontWeight: 700,
            color: isDark ? "#E2E8F0" : "#475569",
          },
          total: {
            show: true,
            label: "Completed Task",
            color: isDark ? "#E2E8F0" : "#475569",
            fontWeight: 400,
            formatter: function () {
              return 70;
            },
          },
        },
      },
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        shadeIntensity: 0.35,
        inverseColors: true,
        opacityFrom: 1,
        opacityTo: 1,
        stops: [0, 50, 65, 91],
      },
    },
    stroke: {
      dashArray: 8,
    },
    colors: [themeConfig.colors.primary],
  };

  return (
    <div>
      <Chart
        series={series}
        options={options}
        type="radialBar"
        height={height}
      />
    </div>
  );
};

export default RadarChart;
