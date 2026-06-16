import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import useDarkMode from "@/hooks/useDarkMode";
import themeConfig from "@/configs/themeConfig";

const angularData = [
  { x: 5.4, y: 170 },
  { x: 5.4, y: 100 },
  { x: 5.7, y: 110 },
  { x: 5.9, y: 150 },
  { x: 6.0, y: 200 },
  { x: 6.3, y: 170 },
  { x: 5.7, y: 140 },
  { x: 5.9, y: 130 },
  { x: 7.0, y: 150 },
  { x: 8.0, y: 120 },
  { x: 9.0, y: 170 },
  { x: 10.0, y: 190 },
  { x: 11.0, y: 220 },
  { x: 12.0, y: 170 },
  { x: 13.0, y: 230 },
];

const vueData = [
  { x: 14.0, y: 220 },
  { x: 15.0, y: 280 },
  { x: 16.0, y: 230 },
  { x: 18.0, y: 320 },
  { x: 17.5, y: 280 },
  { x: 19.0, y: 250 },
  { x: 20.0, y: 350 },
  { x: 20.5, y: 320 },
  { x: 20.0, y: 320 },
  { x: 19.0, y: 280 },
  { x: 17.0, y: 280 },
  { x: 22.0, y: 300 },
  { x: 18.0, y: 120 },
];

const reactData = [
  { x: 14.0, y: 290 },
  { x: 13.0, y: 190 },
  { x: 20.0, y: 220 },
  { x: 21.0, y: 350 },
  { x: 21.5, y: 290 },
  { x: 22.0, y: 220 },
  { x: 23.0, y: 140 },
  { x: 19.0, y: 400 },
  { x: 20.0, y: 200 },
  { x: 22.0, y: 90 },
  { x: 20.0, y: 120 },
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload) {
    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg  ">
        <span>{`${payload[0].value}%`}</span>
      </div>
    );
  }

  return null;
};

const ReScatterChart = () => {
  const [isDark] = useDarkMode();
  return (
    <div>
      <ResponsiveContainer height={350}>
        <ScatterChart height={300}>
          <CartesianGrid
            strokeDasharray="1 1"
            stroke={
              isDark
                ? themeConfig.colors.chart_grid_dark
                : themeConfig.colors.chart_grid_light
            }
          />
          <XAxis
            dataKey="x"
            type="number"
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
            dataKey="y"
            type="number"
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
          <Scatter
            name="Angular"
            data={angularData}
            fill={themeConfig.colors.primary}
          />
          <Scatter
            name="Vue"
            data={vueData}
            fill={themeConfig.colors.success}
          />
          <Scatter
            name="React"
            data={reactData}
            fill={themeConfig.colors.warning}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ReScatterChart;
