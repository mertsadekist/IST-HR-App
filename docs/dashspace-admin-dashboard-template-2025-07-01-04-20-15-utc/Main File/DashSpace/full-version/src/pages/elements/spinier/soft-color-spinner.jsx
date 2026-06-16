import React from "react";

const SoftColorSpinner = () => {
  return (
    <div className="space-xy flex  flex-wrap">
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-indigo-500/30 border-r-indigo-500"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px]  border-fuchsia-500/30 border-r-fuchsia-500"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-cyan-500/30 border-r-cyan-500"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-green-50/30 border-r-green-500"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-yellow-500/30 border-r-yellow-500"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-red-500/30 border-r-red-500"></div>
      <div className="spinner h-7 w-7 animate-spin rounded-full border-[3px] border-gray-500/30 border-r-gray-500 dark:border-r-gray-700"></div>
    </div>
  );
};

export default SoftColorSpinner;
