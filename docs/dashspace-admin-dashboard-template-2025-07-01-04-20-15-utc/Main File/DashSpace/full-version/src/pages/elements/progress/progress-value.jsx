import React from "react";
import ProgressBar from "@/components/ui/ProgressBar";
const ProgressValue = () => {
  return (
    <div className="space-y-4  xl:w-[70%]">
      <ProgressBar
        value={30}
        className="bg-indigo-500 "
        backClass="h-3 rounded-full"
        showValue
      />

      <ProgressBar
        value={50}
        className="bg-yellow-500  "
        backClass="h-3 rounded-full"
        showValue
      />
      <ProgressBar
        value={70}
        className=" bg-cyan-500 "
        backClass="h-3 rounded-full"
        showValue
      />
      <ProgressBar
        value={90}
        className="bg-red-500 "
        showValue
        backClass="h-3 rounded-full"
      />
    </div>
  );
};

export default ProgressValue;
