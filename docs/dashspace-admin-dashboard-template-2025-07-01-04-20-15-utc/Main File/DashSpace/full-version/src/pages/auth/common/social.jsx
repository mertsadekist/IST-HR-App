import React from "react";

import Google from "@/assets/images/svg/google.svg";
import Github from "@/assets/images/svg/github.svg";
const Social = () => {
  return (
    <div className="flex space-x-4 rtl:space-x-reverse">
      <button className="btn btn-outline-light flex-1 flex items-center justify-center space-x-2 rtl:space-x-reverse">
        <div>
          <img src={Google} alt="" className="h-5 w-5" />
        </div>
        <div>Google</div>
      </button>
      <button className="btn btn-outline-light flex-1 flex items-center justify-center space-x-2 rtl:space-x-reverse">
        <div>
          <img src={Github} alt="" className="h-5 w-5" />
        </div>
        <div>Github</div>
      </button>
    </div>
  );
};

export default Social;
