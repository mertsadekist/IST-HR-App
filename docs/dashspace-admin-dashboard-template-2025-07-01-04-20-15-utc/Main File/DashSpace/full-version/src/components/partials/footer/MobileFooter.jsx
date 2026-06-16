import React from "react";
import { NavLink } from "react-router-dom";
import Icon from "@/components/ui/Icon";

import FooterAvatar from "@/assets/images/users/user-1.jpg";
const MobileFooter = () => {
  return (
    <div className="bg-white bg-no-repeat custom-dropshadow footer-bg dark:bg-gray-700 flex justify-around items-center backdrop-filter backdrop-blur-[40px] fixed left-0 w-full z-[9999] bottom-0 py-[12px] px-4">
      <NavLink to="chat">
        {({ isActive }) => (
          <div>
            <span
              className={` relative cursor-pointer rounded-full text-[20px] flex flex-col items-center justify-center mb-1
         ${isActive ? "text-indigo-700" : "dark:text-white text-gray-900"}
          `}
            >
              <Icon icon="heroicons-outline:mail" />
              <span className="absolute right-[5px] lg:top-0 -top-2 h-4 w-4 bg-red-500 text-[8px] font-semibold flex flex-col items-center justify-center rounded-full text-white z-[99]">
                10
              </span>
            </span>
            <span
              className={` block text-[11px]
          ${isActive ? "text-indigo-700" : "text-gray-600 dark:text-gray-300"}
          `}
            >
              Messages
            </span>
          </div>
        )}
      </NavLink>
      <NavLink
        to="profile"
        className="relative bg-white bg-no-repeat backdrop-filter backdrop-blur-[40px] rounded-full footer-bg dark:bg-gray-700 h-[65px] w-[65px] z-[-1] -mt-[40px] flex justify-center items-center"
      >
        {({ isActive }) => (
          <div className="h-[50px] w-[50px] rounded-full relative left-[0px] top-[0px] custom-dropshadow">
            <img
              src={FooterAvatar}
              alt=""
              className={` w-full h-full rounded-full
          ${
            isActive ? "border-2 border-indigo-700" : "border-2 border-gray-100"
          }
              `}
            />
          </div>
        )}
      </NavLink>
      <NavLink to="notifications">
        {({ isActive }) => (
          <div>
            <span
              className={` relative cursor-pointer rounded-full text-[20px] flex flex-col items-center justify-center mb-1
      ${isActive ? "text-indigo-700" : "dark:text-white text-gray-900"}
          `}
            >
              <Icon icon="heroicons-outline:bell" />
              <span className="absolute right-[17px] lg:top-0 -top-2 h-4 w-4 bg-red-500 text-[8px] font-semibold flex flex-col items-center justify-center rounded-full text-white z-[99]">
                2
              </span>
            </span>
            <span
              className={` block text-[11px]
         ${isActive ? "text-indigo-700" : "text-gray-600 dark:text-gray-300"}
        `}
            >
              Notifications
            </span>
          </div>
        )}
      </NavLink>
    </div>
  );
};

export default MobileFooter;
