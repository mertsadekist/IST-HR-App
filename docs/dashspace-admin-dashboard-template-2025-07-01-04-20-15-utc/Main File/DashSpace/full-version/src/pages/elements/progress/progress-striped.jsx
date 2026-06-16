import React from "react";
import ProgressBar from "@/components/ui/ProgressBar";
const ProgressStriped = () => {
  return (
    <div className="space-y-4  xl:w-[70%]">
      <ProgressBar
        value={30}
        className="bg-gray-900 "
        striped
        backClass="h-3 rounded-full"
      />{" "}
      <ProgressBar
        value={30}
        className="bg-indigo-500 "
        striped
        backClass="h-3 rounded-full"
      />
      <ProgressBar
        value={80}
        className="bg-red-500 "
        striped
        backClass="h-3 rounded-full"
      />
      <ProgressBar
        value={50}
        className="bg-yellow-500  "
        striped
        backClass="h-3 rounded-full"
      />
      <ProgressBar
        value={70}
        className=" bg-cyan-500 "
        striped
        backClass="h-3 rounded-full"
      />
    </div>
  );
};

export default ProgressStriped;
