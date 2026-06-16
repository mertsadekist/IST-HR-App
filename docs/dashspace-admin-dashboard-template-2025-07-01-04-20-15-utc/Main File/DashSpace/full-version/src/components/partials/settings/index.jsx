import React, { Fragment } from "react";
import Icon from "@/components/ui/Icon";
import { Transition } from "@headlessui/react";
import SimpleBar from "simplebar-react";
import Semidark from "./Tools/Semidark";
import RtlSwicth from "./Tools/Rtl";
import Theme from "./Tools/Theme";
import ContentWidth from "./Tools/ContentWidth";
import Menulayout from "./Tools/Menulayout";
import MenuClose from "./Tools/MenuClose";
import MenuHidden from "./Tools/MenuHidden";
import useWidth from "@/hooks/useWidth";
import { motion, useCycle } from "framer-motion";
import { handleCustomizer } from "@/store/layout";
import { useSelector, useDispatch } from "react-redux";

const Settings = () => {
  const { width, breakpoints } = useWidth();
  const customizer = useSelector((state) => state.layout.customizer);
  const dispatch = useDispatch();

  const setCustomizer = (val) => dispatch(handleCustomizer(val));

  const handleSidebarToggle = () => {
    toggleOpen();
    setCustomizer(!customizer);
  };

  return (
    <div>
      <div
        className={`
        setting-wrapper fixed ltr:right-0 rtl:left-0 top-0 md:w-[400px] w-[300px] z-[9999]
         bg-white dark:bg-gray-800 h-screen   md:pb-6 pb-[100px] shadow-base2
          dark:shadow-base3 border border-gray-200 dark:border-gray-700 
          ${isOpen ? "ml-0 " : " ml-[-400px]"}
        `}
      >
        <SimpleBar className="px-6 h-full">
          <header className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 -mx-5 px-6 py-[15px] mb-6">
            <div>
              <span className="block text-xl text-gray-900 font-medium dark:text-[#eee]">
                Theme customizer
              </span>
              <span className="block text-sm font-light text-[#68768A] dark:text-[#eee]">
                Customize & Preview in Real Time
              </span>
            </div>
            <div
              className="cursor-pointer text-2xl text-gray-800 dark:text-gray-200"
              onClick={handleSidebarToggle}
            >
              <Icon icon="heroicons-outline:x" />
            </div>
          </header>
          <div className=" space-y-4">
            {/* theme start */}
            <div>
              <Theme />
            </div>
            {/* semi dark start */}
            <div>
              <Semidark />
            </div>
            {/* hr start */}
            <div>
              <hr className="-mx-5 border-gray-200 dark:border-gray-700" />
            </div>
            {/* switch start */}

            <div>
              <RtlSwicth />
            </div>
            {/* hr start */}
            <div>
              <hr className="-mx-5 border-gray-200 dark:border-gray-700" />
            </div>
            {/* content width start */}
            <div>
              <ContentWidth />
            </div>
            {/* menu layout */}
            <div>{width >= breakpoints.xl && <Menulayout />}</div>
            {/* menu close */}
            <div className="pt-4">
              <MenuClose />
            </div>
            {/* menu hidden */}
            <div className="pt-2">
              <MenuHidden />
            </div>
          </div>
        </SimpleBar>
      </div>

      <Transition as={Fragment} show={customizer}>
        <div
          className="overlay bg-white bg-opacity-0  backdrop-blur-[0px] fixed inset-0 z-[999]"
          onClick={handleSidebarToggle}
        ></div>
      </Transition>
    </div>
  );
};

export default Settings;
