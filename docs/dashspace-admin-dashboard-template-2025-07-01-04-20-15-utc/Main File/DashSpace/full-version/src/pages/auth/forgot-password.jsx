import React from "react";
import { Link } from "react-router-dom";
import ForgotPass from "./common/forgot-pass";
import useDarkMode from "@/hooks/useDarkMode";

import Logo from "@/assets/images/logo/logo-c.svg";
const forgotPass = () => {
  const [isDark] = useDarkMode();
  return (
    <div className="h-full grid w-full grow grid-cols-1 place-items-center pt-10 2xl:pt-0 ">
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
            Forgot Your Password?
          </div>
          <div className=" text-gray-500 dark:text-gray-400 text-sm">
            Reset Password with Admin DashSpace.
          </div>
        </div>
        <div className="p-6 auth-box">
          <ForgotPass />
          <div className=" text-center text-sm mt-5 space-x-1 rtl:space-x-reverse mb-1  ">
            <span> Forget It,</span>
            <span>
              <Link to="/" className=" text-indigo-500">
                Send me Back
              </Link>
            </span>
            <span>to The Sign In</span>
          </div>
        </div>
        <div className="mt-8 flex justify-center text-xs text-gray-400  pb-10 2xl:pb-0">
          <a href="#">Privacy Notice</a>
          <div className="mx-3 my-1 w-px bg-gray-200 "></div>
          <a href="#">Term of service</a>
        </div>
      </div>
    </div>
  );
};

export default forgotPass;
