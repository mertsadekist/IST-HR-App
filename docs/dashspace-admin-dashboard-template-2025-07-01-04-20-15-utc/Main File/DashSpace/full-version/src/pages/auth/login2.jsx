import React from "react";
import { Link } from "react-router-dom";
import LoginForm from "./common/login-form";
import Social from "./common/social";
import useDarkMode from "@/hooks/useDarkMode";
import Logo from "@/assets/images/logo/logo-c.svg";
import VectorsImage from "@/assets/images/vectors-image/vectors-1.svg";

const login2 = () => {
  const [isDark] = useDarkMode();
  return (
    <>
      <div className="h-full grid grid-cols-12 relative ">
        <div className="xl:col-span-8 lg:col-span-7 col-span-12 lg:block hidden  bg-indigo-100">
          <div className=" w-full 2xl:max-w-4xl xl:max-w-2xl max-w-lg p-6 mx-auto ">
            <img
              src={VectorsImage}
              alt="image name"
              className="  block mx-auto"
            />
          </div>
        </div>
        <div className="xl:col-span-4 lg:col-span-5  col-span-12  ">
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
                Welcome Back
              </div>
              <div className=" text-gray-500 dark:text-gray-400 text-sm mb-6">
                Please sign in to continue
              </div>
              {/* logo wrapper end */}
              <LoginForm />
              <div className=" text-center text-sm mt-5 space-x-1 rtl:space-x-reverse mb-1  ">
                <span> Don't have Account?</span>
                <span>
                  <Link to="/register2" className=" text-indigo-500">
                    Create account
                  </Link>
                </span>
              </div>
              <div className="relative border-b-gray-10 dark:border-gray-700  border-b pt-6">
                <div className="absolute inline-block bg-white dark:bg-gray-800 text-gray-400 left-1/2 top-1/2 transform -translate-x-1/2 px-4 min-w-max text-sm  font-normal">
                  OR
                </div>
              </div>
              <div className="mt-6">
                <Social />
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
    </>
  );
};

export default login2;
