import React from "react";
import world from "@/mocks/world-map.json";
import { VectorMap } from "@south-paw/react-vector-maps";

import Usa from "@/assets/images/flags/usa.png";
import Chin from "@/assets/images/flags/chin2.svg";
import Russia from "@/assets/images/flags/russia.svg";

const VisitorMap = () => {
  return (
    <div>
      <VectorMap {...world} className="h-[270px] w-full dash-codevmap" />
      <ul className=" grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 mt-6">
        <li className="single-item ">
          <div className="w-8">
            <img src={Usa} alt="" className=" mb-2 block" />
          </div>
          <div className="  font-gray-800 dark:text-white text-base truncate mb-0.5 ">
            United Kingdom
          </div>
          <div className="  text-xs text-gray-500 dark:text-gray-400">
            54% . 5,761,687 Users
          </div>
        </li>
        {/* end single  */}
        <li className="single-item ">
          <div className="w-8">
            <img src={Chin} alt="" className=" mb-2 block" />
          </div>
          <div className="  font-gray-800 dark:text-white text-base truncate mb-0.5 ">
            China
          </div>
          <div className="  text-xs text-gray-500 dark:text-gray-400">
            20% . 5,761,687 Users
          </div>
        </li>
        {/* end single  */}
        <li className="single-item ">
          <div className="w-8">
            <img src={Russia} alt="" className=" mb-2 block" />
          </div>
          <div className="  font-gray-800 dark:text-white text-base truncate mb-0.5 ">
            Russia
          </div>
          <div className="  text-xs text-gray-500 dark:text-gray-400">
            34% . 5,761,687 Users
          </div>
        </li>
        {/* end single  */}
      </ul>
    </div>
  );
};

export default VisitorMap;
