import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import useDarkMode from "@/hooks/useDarkMode";
import themeConfig from "@/configs/themeConfig";
import { hexToRGB } from "@/mocks/data";

const data = [
  {
    name: "7/12",
    sales: 20,
    clicks: 60,
    visits: 100,
  },
  {
    name: "8/12",
    sales: 40,
    clicks: 80,
    visits: 120,
  },
  {
    name: "9/12",
    sales: 30,
    clicks: 70,
    visits: 90,
  },
  {
    name: "10/12",
    sales: 70,
    clicks: 110,
    visits: 170,
  },
  {
    name: "11/12",
    sales: 40,
    clicks: 80,
    visits: 130,
  },
  {
    name: "12/12",
    sales: 60,
    clicks: 80,
    visits: 160,
  },
  {
    name: "13/12",
    sales: 50,
    clicks: 100,
    visits: 140,
  },
  {
    name: "14/12",
    sales: 140,
    clicks: 90,
    visits: 240,
  },
  {
    name: "15/12",
    sales: 120,
    clicks: 180,
    visits: 220,
  },
  {
    name: "16/12",
    sales: 100,
    clicks: 160,
    visits: 180,
  },
  {
    name: "17/12",
    sales: 140,
    clicks: 140,
    visits: 270,
  },
  {
    name: "18/12",
    sales: 180,
    clicks: 200,
    visits: 280,
  },
  {
    name: "19/12",
    sales: 220,
    clicks: 220,
    visits: 375,
  },
];

const CustomTooltip = (data) => {
  if (data.active && data.payload) {
    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg">
        <p className=" font-semibold text-base border-b border-gray-700 -mx-3  mb-3  pb-3 px-3 ">
          {data.label}
        </p>

        <div className="active">
          {data.payload.map((i) => {
            return (
              <div className=" items-center flex space-x-2" key={i.dataKey}>
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: i.fill,
                  }}
                ></span>
                <span className="  capitalize text-sm">
                  {i.dataKey} : {i.payload[i.dataKey]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};

const ReAreaChart = ({ height = 350 }) => {
  const [isDark] = useDarkMode();
  return (
    <div>
      <ResponsiveContainer height={height}>
        <AreaChart height={300} data={data}>
          <CartesianGrid
            strokeDasharray="1 1"
            stroke={
              isDark
                ? themeConfig.colors.chart_grid_dark
                : themeConfig.colors.chart_grid_light
            }
          />
          <XAxis
            dataKey="name"
            tick={{
              fill: isDark
                ? themeConfig.colors.chart_text_dark
                : themeConfig.colors.chart_text_light,
            }}
            tickLine={{
              stroke: isDark
                ? themeConfig.colors.chart_grid_dark
                : themeConfig.colors.chart_grid_light,
            }}
            stroke={
              isDark
                ? themeConfig.colors.chart_grid_dark
                : themeConfig.colors.chart_grid_light
            }
          />
          <YAxis
            tick={{
              fill: isDark
                ? themeConfig.colors.chart_text_dark
                : themeConfig.colors.chart_text_light,
            }}
            tickLine={{
              stroke: isDark
                ? themeConfig.colors.chart_grid_dark
                : themeConfig.colors.chart_grid_light,
            }}
            stroke={
              isDark
                ? themeConfig.colors.chart_grid_dark
                : themeConfig.colors.chart_grid_light
            }
          />
          <Tooltip content={CustomTooltip} />

          <Area
            dataKey="sales"
            stackId="sales"
            stroke="0"
            fill={hexToRGB(themeConfig.colors.primary, 0.5)}
          />
          <Area
            dataKey="clicks"
            stackId="clicks"
            stroke="0"
            fill={hexToRGB(themeConfig.colors.primary, 1)}
          />
          <Area
            dataKey="visits"
            stackId="visits"
            stroke="0"
            fill={hexToRGB(themeConfig.colors.primary, 0.2)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ReAreaChart;
