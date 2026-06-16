import React from "react";
import ProgressBar from "@/components/ui/ProgressBar";
const AnimatedStripped = () => {
  return (
    <div className="space-y-4  xl:w-[70%]">
      <ProgressBar
        value={30}
        className="bg-gray-900 "
        striped
        backClass="h-3 rounded-full"
        animate
      />
      <ProgressBar
        value={60}
        className="bg-indigo-500 "
        striped
        backClass="h-3 rounded-full"
        animate
      />
      <ProgressBar
        value={40}
        className="bg-red-500 "
        striped
        backClass="h-3 rounded-full"
        animate
      />
      <ProgressBar
        value={50}
        className="bg-yellow-500  "
        striped
        backClass="h-3 rounded-full"
        animate
      />
      <ProgressBar
        value={70}
        className=" bg-cyan-500 "
        striped
        backClass="h-3 rounded-full"
        animate
      />
    </div>
  );
};

export default AnimatedStripped;
