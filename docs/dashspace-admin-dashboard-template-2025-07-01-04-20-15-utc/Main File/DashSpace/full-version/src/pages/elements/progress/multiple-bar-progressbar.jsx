import React from "react";
import ProgressBar from "@/components/ui/ProgressBar";
import Bar from "@/components/ui/ProgressBar/Bar";
const MultipleBarProgressbar = () => {
  return (
    <div className=" space-y-4 xl:w-[70%]">
      <ProgressBar backClass="h-3 rounded-full">
        <Bar value={10} className="bg-indigo-500" />
        <Bar value={15} className=" bg-yellow-500" />
        <Bar value={20} className=" bg-red-500" />
        <Bar value={20} className="bg-cyan-500" />
      </ProgressBar>
      <ProgressBar backClass="h-3 rounded-full">
        <Bar value={10} className="bg-indigo-500" showValue />
        <Bar value={15} className=" bg-yellow-500" showValue />
        <Bar value={20} className=" bg-red-500" showValue />
        <Bar value={20} className="bg-cyan-500" showValue />
      </ProgressBar>
    </div>
  );
};

export default MultipleBarProgressbar;
