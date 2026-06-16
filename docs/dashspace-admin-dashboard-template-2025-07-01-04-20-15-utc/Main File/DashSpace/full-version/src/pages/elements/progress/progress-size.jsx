import React from "react";
import ProgressBar from "@/components/ui/ProgressBar";
const ProgressSize = () => {
  return (
    <div className="space-y-4  xl:w-[70%]">
      <ProgressBar value={30} />
      <ProgressBar
        value={50}
        backClass="h-[10px] rounded-full"
        className="bg-indigo-500"
      />
      <ProgressBar
        value={80}
        backClass="h-[14px] rounded-full"
        className="bg-red-500"
      />
      <ProgressBar
        value={70}
        backClass="h-4 rounded-full"
        className="bg-yellow-500"
      />
    </div>
  );
};

export default ProgressSize;
