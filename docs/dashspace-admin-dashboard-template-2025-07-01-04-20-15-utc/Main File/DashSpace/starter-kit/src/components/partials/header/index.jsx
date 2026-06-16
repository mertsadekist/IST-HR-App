import React, { useState, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import SwitchDark from "./Tools/SwitchDark";
import HorizentalMenu from "./Tools/HorizentalMenu";
import useWidth from "@/hooks/useWidth";
import useSidebar from "@/hooks/useSidebar";
import useMenulayout from "@/hooks/useMenulayout";
import Logo from "./Tools/Logo";
import SearchBox from "./Tools/SearchBox";
import Profile from "./Tools/Profile";
import Notification from "./Tools/Notification";
import Message from "./Tools/Message";
import Language from "./Tools/Language";
import useRtl from "@/hooks/useRtl";
import useMobileMenu from "@/hooks/useMobileMenu";
import Settings from "./Tools/Settings";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { motion, useAnimation } from "framer-motion";
import clsx from "clsx";
const Header = ({ className = "custom-class", title }) => {
  const [sticky, setSticky] = useState(true);
  const [collapsed, setMenuCollapsed] = useSidebar();
  const { width, breakpoints } = useWidth();

  const [menuType] = useMenulayout();

  const [isRtl] = useRtl();

  const [mobileMenu, setMobileMenu] = useMobileMenu();
  const controls = useAnimation();
  const handleOpenMobileMenu = () => {
    setMobileMenu(!mobileMenu);
  };

  return (
    <header
      className={clsx(
        className,
        "transition-all  duration-300 has-sticky-header "
      )}
    >
      <div
        className={clsx(
          " app-header md:px-6 px-[15px] transition-all  duration-300 backdrop-blur-[6px]  ",
          {
            "bg-transparent": !sticky && menuType === "vertical",
            "bg-white dark:bg-gray-800 shadow-base": sticky,
            "horizontal_menu bg-white dark:bg-gray-800 shadow-base":
              menuType === "horizontal" && width > breakpoints.xl,
            "vertical_menu ": menuType === "vertical",
            "pt-6": menuType === "vertical" && !sticky,
            "py-3": menuType === "vertical" && sticky,
          }
        )}
      >
        <div className="flex justify-between items-center h-full relative">
          {/* For Vertical  */}

          {menuType === "vertical" && (
            <div className="flex items-center md:space-x-4 space-x-2 rtl:space-x-reverse">
              {width < breakpoints.xl && <Logo />}
              <div>
                <SearchBox />
              </div>
            </div>
          )}

          {/* For Horizontal  */}
          {menuType === "horizontal" && (
            <div className="flex items-center space-x-4 rtl:space-x-reverse">
              <Logo />
              {/* open mobile menu handlaer*/}
              {width <= breakpoints.xl && (
                <div
                  className="cursor-pointer text-gray-900 dark:text-white text-2xl"
                  onClick={handleOpenMobileMenu}
                >
                  <Icon icon="heroicons-outline:menu-alt-3" />
                </div>
              )}
            </div>
          )}
          {/*  Horizontal  Main Menu */}
          {menuType === "horizontal" && width >= breakpoints.xl ? (
            <HorizentalMenu />
          ) : null}
          {/* Nav Tools  */}
          <div className="nav-tools flex items-center lg:space-x-6 space-x-3 rtl:space-x-reverse">
            <Language />
            <SwitchDark />
            <Settings />
            <Message />
            <Notification />
            <Profile sticky={sticky} />

            <div
              className="cursor-pointer text-gray-900 dark:text-white text-2xl xl:hidden  block"
              onClick={handleOpenMobileMenu}
            >
              <Icon icon="heroicons-outline:menu-alt-3" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
