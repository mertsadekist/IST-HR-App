import React from "react";
import { Collapse } from "react-collapse";
import { NavLink } from "react-router-dom";
const Multilevel = ({ activeMultiMenu, j, subItem }) => {
  return (
    <Collapse isOpened={activeMultiMenu === j}>
      <ul className="space-y-[14px] pl-5">
        {subItem?.submenu?.map((item, i) => (
          <li key={i} className=" first:pt-[14px]">
            <NavLink to={item.subChildLink}>
              {({ isActive }) => (
                <div>
                  <div
                    className={`${
                      isActive
                        ? " text-indigo-500 dark:text-white "
                        : "text-gray-600 dark:text-gray-300"
                    } text-sm flex space-x-3 items-center transition-all duration-150`}
                  >
                    <span
                      className={`${
                        isActive
                          ? " bg-indigo-500 dark:bg-gray-300   "
                          : " bg-gray-600 dark:bg-white"
                      } h-1.5 w-1.5 rounded-full border  inline-block flex-none`}
                    ></span>
                    <span className="flex-1">{item.subChildTitle}</span>
                  </div>
                </div>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </Collapse>
  );
};

export default Multilevel;
