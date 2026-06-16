import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import useDarkMode from "@/hooks/useDarkMode";
import themeConfig from "@/configs/themeConfig";
const data = [
  {
    name: "7/12",
    react: 80,
    vue: 130,
    svelte: 150,
    angular: 210,
  },
  {
    name: "8/12",
    react: 100,
    vue: 150,
    svelte: 170,
    angular: 380,
  },
  {
    name: "9/12",
    react: 80,
    vue: 140,
    svelte: 160,
    angular: 220,
  },
  {
    name: "10/12",
    react: 100,
    vue: 150,
    svelte: 170,
    angular: 380,
  },
  {
    name: "11/12",
    react: 50,
    vue: 90,
    svelte: 110,
    angular: 150,
  },
  {
    name: "12/12",
    react: 125,
    vue: 90,
    svelte: 100,
    angular: 65,
  },
  {
    name: "13/12",
    react: 70,
    vue: 110,
    svelte: 130,
    angular: 210,
  },
  {
    name: "14/12",
    react: 100,
    vue: 150,
    svelte: 170,
    angular: 380,
  },
  {
    name: "15/12",
    react: 80,
    vue: 100,
    svelte: 120,
    angular: 180,
  },
  {
    name: "16/12",
    react: 30,
    vue: 60,
    svelte: 70,
    angular: 110,
  },
];

const CustomTooltip = (data) => {
  if (data.active && data.payload) {
    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg">
        <p className="font-semibold text-base border-b border-gray-700 -mx-3  mb-3  pb-3 px-3 ">
          {data.label}
        </p>
        <div className="active">
          {data.payload.map((i) => {
            return (
              <div className="flex items-center  space-x-2" key={i.dataKey}>
                <span
                  className="h-3 w-3 rounded-full inline-block "
                  style={{
                    backgroundColor: i.fill,
                  }}
                ></span>
                <span className=" capitalize text-sm">
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

const ReBarChart = ({ height = 350 }) => {
  const [isDark] = useDarkMode();
  return (
    <div>
      <ResponsiveContainer height={height}>
        <BarChart height={300} data={data} barSize={15}>
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
          <Bar dataKey="react" stackId="a" fill={themeConfig.colors.primary} />
          <Bar dataKey="vue" stackId="a" fill={themeConfig.colors.success} />
          <Bar dataKey="svelte" stackId="a" fill={themeConfig.colors.warning} />
          <Bar
            dataKey="angular"
            stackId="a"
            fill={themeConfig.colors.primary}
            radius={[15, 15, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ReBarChart;
