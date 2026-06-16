import React from "react";
import { Link } from "react-router-dom";
import useDarkMode from "@/hooks/useDarkMode";
import RegForm from "./common/reg-from";
import Social from "./common/social";
// image import

import Logo from "@/assets/images/logo/logo-c.svg";

const register = () => {
  const [isDark] = useDarkMode();
  return (
    <>
      <div className="h-full grid w-full grow grid-cols-1 place-items-center ">
        <div className=" max-w-[416px] mx-auto w-full  space-y-6">
          <div className="text-center">
            <div className="h-[72px] w-[72px] mx-auto">
              <Link to="/">
                <img
                  src={Logo}
                  alt=""
                  className=" object-contain object-center h-full"
                />
              </Link>
            </div>
            <div className=" text-2xl font-semibold text-gray-600 dark:text-gray-300 mb-1 mt-5">
              Welcome To Admin DashSpace
            </div>
            <div className=" text-gray-500 dark:text-gray-400 text-sm">
              Please sign up to continue
            </div>
          </div>
          <div className="p-6 auth-box">
            <RegForm />
            <div className=" text-center text-sm mt-5 space-x-1 rtl:space-x-reverse mb-1  ">
              <span> Already have an account</span>
              <span>
                <Link to="/" className=" text-indigo-500">
                  Sign In
                </Link>
              </span>
            </div>
            <div className="relative border-b-gray-10  dark:border-gray-700 border-b pt-6">
              <div className="absolute text-[12px] inline-block bg-white dark:bg-gray-800 text-gray-400 left-1/2 top-1/2 transform -translate-x-1/2 px-4 min-w-max text-sm  font-normal">
                OR SIGN UP WITH EMAIl
              </div>
            </div>
            <div className="mt-6">
              <Social />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default register;
