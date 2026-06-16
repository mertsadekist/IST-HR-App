import React from "react";

import { Link } from "react-router-dom";
import ForgotPass from "./common/forgot-pass";
import useDarkMode from "@/hooks/useDarkMode";
import VectorsImage from "@/assets/images/vectors-image/vectors-1.svg";
import Logo from "@/assets/images/logo/logo-c.svg";
const ForgotPass2 = () => {
  const [isDark] = useDarkMode();
  return (
    <div className="h-full grid grid-cols-12 ">
      <div className="col-span-8 bg-indigo-100">
        <div className=" w-full 2xl:max-w-4xl xl:max-w-2xl max-w-lg p-6 mx-auto ">
          <img
            src={VectorsImage}
            alt="image name"
            className="  block mx-auto"
          />
        </div>
      </div>
      <div className="col-span-4">
        <div className="bg-white h-full py-6 px-14 flex flex-col justify-center">
          {/* logo wrapper start */}
          <div className="grow flex flex-col justify-center">
            <div className="h-[62px] w-[62px]">
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
            <div className=" text-gray-500 dark:text-gray-400 text-sm mb-6">
              Reset Password with Admin DashSpace.
            </div>
            {/* logo wrapper end */}
            <ForgotPass />
            <div className=" text-center text-sm mt-5 space-x-1 rtl:space-x-reverse mb-1  ">
              <span> Forget It,</span>
              <span>
                <Link to="/login2" className=" text-indigo-500">
                  Send me Back
                </Link>
              </span>
              <span>to The Sign In</span>
            </div>
          </div>
          <div className="">
            <div className="mt-8 flex justify-center text-xs text-gray-400  ">
              <a href="#">Privacy Notice</a>
              <div className="mx-3 my-1 w-px bg-gray-200 "></div>
              <a href="#">Term of service</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPass2;
