import React from "react";

const Footer = ({ className = "custom-class" }) => {
  return (
    <footer className={className}>
      <div className="site-footer px-6 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 py-4">
        <div className="grid md:grid-cols-2 grid-cols-1 md:gap-5">
          <div className="text-center ltr:md:text-start rtl:md:text-right text-sm">
            COPYRIGHT &copy; 2022 DashSpace, All rights Reserved
          </div>
          <div className="ltr:md:text-right rtl:md:text-end text-center text-sm">
            Hand-crafted & Made by{" "}
            <a
              href="https://themeforest.net/user/freekytheme"
              target="_blank"
              className="text-indigo-700 font-semibold"
            >
              freekytheme
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
