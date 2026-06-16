import React from "react";

import world from "@/mocks/world-map.json";
import { VectorMap } from "@south-paw/react-vector-maps";

const VMap = () => {
  return (
    <div className="  w-full ">
      <VectorMap {...world} className="h-[270px] w-full dash-codevmap" />
    </div>
  );
};

export default VMap;
