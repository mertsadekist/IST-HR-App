import React, { useState } from "react";
import Switch from "@/components/ui/Switch";
import useSemiDark from "@/hooks/useSemiDark";

const Semidark = () => {
  const [isSemiDark, setSemiDark] = useSemiDark();
  return (
    <div className=" flex justify-between">
      <div className="text-gray-600 text-base dark:text-gray-300 font-normal">
        Semi Dark
      </div>
      <Switch
        value={isSemiDark}
        onChange={() => setSemiDark(!isSemiDark)}
        id="semi_nav_tools"
      />
    </div>
  );
};

export default Semidark;
