import React from "react";
import ProgressBar from "@/components/ui/ProgressBar";
const BasicProgress = () => {
  return (
    <div className="space-y-4  xl:w-[70%]">
      <ProgressBar value={30} className="bg-indigo-500" />
      <ProgressBar value={50} className=" bg-fuchsia-500" />
      <ProgressBar value={70} className=" bg-green-500" />
      <ProgressBar value={80} className=" bg-cyan-500" />
      <ProgressBar value={90} className="bg-yellow-500" />
      <ProgressBar value={95} className=" bg-red-500" />
    </div>
  );
};

export default BasicProgress;
