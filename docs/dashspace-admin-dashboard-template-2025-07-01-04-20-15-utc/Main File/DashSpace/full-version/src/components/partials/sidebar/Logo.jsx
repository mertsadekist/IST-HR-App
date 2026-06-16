import React from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/Icon";
import useDarkMode from "@/hooks/useDarkMode";
import useSidebar from "@/hooks/useSidebar";
import useSemiDark from "@/hooks/useSemiDark";

// import images
import MobileLogo from "@/assets/images/logo/logo-c.svg";
import MobileLogoWhite from "@/assets/images/logo/logo-c-white.svg";

const SidebarLogo = ({ menuHover }) => {
  const [isDark] = useDarkMode();
  const [collapsed, setMenuCollapsed] = useSidebar();
  // semi dark
  const [isSemiDark] = useSemiDark();

  return (
    <div
      className={` logo-segment flex justify-between items-center bg-white dark:bg-gray-800 z-[9] py-6  px-4  
      ${menuHover ? "logo-hovered" : ""}
       
      
      `}
    >
      <Link to="/dashboard">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <div className="logo-icon h-[40px]">
            {!isDark && !isSemiDark ? (
              <img src={MobileLogo} alt="" className=" h-full" />
            ) : (
              <img src={MobileLogoWhite} alt="" className=" h-full" />
            )}
          </div>

          {(!collapsed || menuHover) && (
            <div>
              <h1 className="text-[22px] font-medium  ">DashSpace</h1>
            </div>
          )}
        </div>
      </Link>

      {(!collapsed || menuHover) && (
        <div
          onClick={() => setMenuCollapsed(!collapsed)}
          className={`h-4 w-4 border-[1px] border-gray-900 dark:border-gray-700 rounded-full transition-all duration-150
          ${
            collapsed
              ? ""
              : "ring-1 ring-inset ring-offset-[4px] ring-gray-900 dark:ring-gray-400 bg-gray-900 dark:bg-gray-400 dark:ring-offset-gray-700"
          }
          `}
        ></div>
      )}
    </div>
  );
};

export default SidebarLogo;
