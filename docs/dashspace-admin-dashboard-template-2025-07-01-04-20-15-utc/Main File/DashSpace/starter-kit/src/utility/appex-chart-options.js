// appex chart option will go there
import themeConfig from "@/configs/themeConfig";
export const getYAxisConfig = (isDark) => ({
  labels: getLabel(isDark),
});

export const getXAxisConfig = (isDark) => ({
  categories: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  labels: getLabel(isDark),
  axisBorder: {
    show: false,
  },
  axisTicks: {
    show: false,
  },
});

export const getLabel = (isDark) => ({
  style: {
    colors: isDark
      ? themeConfig.colors.chart_text_dark
      : themeConfig.colors.chart_text_light,
    fontFamily: "Inter",
  },
});

export const getGridConfig = (isDark) => ({
  show: true,
  borderColor: isDark
    ? themeConfig.colors.chart_grid_dark
    : themeConfig.colors.chart_grid_light,
  strokeDashArray: 10,
  position: "back",
});
