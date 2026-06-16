import React from "react";
import { topMenu } from "@/mocks/data";
import Icon from "@/components/ui/Icon";
import { Link } from "react-router-dom";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
const HorizentalMenu = () => {
  return (
    <div className="main-menu">
      <ul>
        {topMenu?.map((item, i) => (
          <li
            key={i}
            className={
              item.child
                ? "menu-item-has-children"
                : "" || item.megamenu
                ? "menu-item-has-children has-megamenu"
                : ""
            }
          >
            {/* Single menu*/}
            {!item.child && !item.megamenu && (
              <Link to={item.link}>
                <div className="flex flex-1 items-center space-x-[6px] rtl:space-x-reverse">
                  <span className="icon-box">
                    <Icon icon={item.icon} />
                  </span>
                  <div className="text-box">{item.title}</div>
                </div>
              </Link>
            )}
            {/* has dropdown*/}
            {(item.child || item.megamenu) && (
              <a href="#">
                <div className="flex flex-1 items-center space-x-[6px] rtl:space-x-reverse">
                  <span className="icon-box">
                    <Icon icon={item.icon} />
                  </span>
                  <div className="text-box">{item.title}</div>
                </div>
                <div className="flex-none text-sm ltr:ml-3 rtl:mr-3 leading-[1] relative top-1">
                  <Icon icon="heroicons-outline:chevron-down" />
                </div>
              </a>
            )}
            {/* Dropdown menu*/}
            {item.child && (
              <ul className="sub-menu  divide-y divide-gray-100 dark:divide-gray-800">
                {item.child.map((childitem, index) => (
                  <li key={index}>
                    <NavLink to={childitem.childlink}>
                      {({ isActive }) => (
                        <div
                          className={clsx(
                            " flex space-x-2 items-center rtl:space-x-reverse       border-b border-b-gray-100 border-opacity-10 px-4 py-2  ",
                            {
                              "bg-indigo-500 text-white": isActive,
                              "hover:bg-indigo-500/10  hover:text-indigo-500":
                                !isActive,
                            }
                          )}
                        >
                          <Icon
                            icon={childitem.childicon}
                            className="leading-[1] text-base"
                          />
                          <span className="leading-[1]">
                            {childitem.childtitle}
                          </span>
                        </div>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
            {/* Megamenu*/}
            {item.megamenu && (
              <div className="rt-mega-menu max-w-3xl">
                <div className="flex flex-wrap space-x-8 justify-between rtl:space-x-reverse px-4 py-4">
                  {item.megamenu.map((m_item, m_i) => (
                    <div key={m_i}>
                      {/* mega menu title*/}
                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex space-x-1 items-center">
                        {/* <Icon icon={m_item.megamenuicon} /> */}
                        <span> {m_item.megamenutitle}</span>
                      </div>
                      {/* single menu item*/}
                      {m_item.singleMegamenu.map((ms_item, ms_i) => (
                        <NavLink to={ms_item.m_childlink} key={ms_i}>
                          {({ isActive }) => (
                            <div className="flex items-center space-x-2 text-sm leading-6 rtl:space-x-reverse  py-1 ">
                              <span
                                className={`h-1.5 w-1.5 rounded-full border bg-gray-600 dark:border-white inline-block flex-none ${
                                  isActive ? " bg-indigo-500 dark:bg-white" : ""
                                }`}
                              ></span>
                              <span
                                className={`capitalize ${
                                  isActive
                                    ? " text-indigo-500 dark:text-white font-medium"
                                    : "text-gray-600 dark:text-gray-300"
                                }`}
                              >
                                {ms_item.m_childtitle}
                              </span>
                            </div>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HorizentalMenu;
