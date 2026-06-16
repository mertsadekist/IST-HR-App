import React, { useState } from "react";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";

const tables = [
  {
    title: "Basic",
    icon: "ph:car-profile-fill",
    price_Yearly: "$96",
    price_Monthly: "$26",
    button: "Buy now",
    bg: "bg-yellow-500",
    child: [
      {
        icon: "ci:check",
        className: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500",
        text: "Lorem ipsum",
      },
      {
        icon: "ci:check",
        className: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500",
        text: "Lorem set",
      },
      {
        icon: "ci:check",
        className: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500",
        text: "Lorem ipsum dolor.",
      },
      {
        icon: "ion:close",
        className: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500",
        text: "Lorem ipsum dolor sit amet, consectetur.",
      },
      {
        icon: "ion:close",
        className: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500",
        text: "Only lorem.",
      },
      {
        icon: "ion:close",
        className: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500",
        text: "Lorem ipsum dolor.",
      },
    ],
  },
  {
    title: "Pro",
    icon: "ph:airplane-in-flight-fill",
    price_Yearly: "$196",
    price_Monthly: "$20",
    button: "Buy now",
    bg: "bg-indigo-500",
    ribon: "Most popular",
    child: [
      {
        icon: "ci:check",
        className: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500",
        text: "Lorem ipsum",
      },
      {
        icon: "ci:check",
        className: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500",
        text: "Lorem set",
      },
      {
        icon: "ci:check",
        className: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500",
        text: "Lorem ipsum dolor.",
      },
      {
        icon: "ion:close",
        className: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500",
        text: "Lorem ipsum dolor sit amet, consectetur.",
      },
      {
        icon: "ion:close",
        className: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500",
        text: "Only lorem.",
      },
      {
        icon: "ion:close",
        className: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500",
        text: "Lorem ipsum dolor.",
      },
    ],
  },
  {
    title: "Enterprices",
    icon: "ph:rocket-fill",
    price_Yearly: "$226",
    price_Monthly: "$216",
    button: "Buy now",
    bg: "bg-green-500",
    child: [
      {
        icon: "ci:check",
        className: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500",
        text: "Lorem ipsum",
      },
      {
        icon: "ci:check",
        className: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500",
        text: "Lorem set",
      },
      {
        icon: "ci:check",
        className: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500",
        text: "Lorem ipsum dolor.",
      },
      {
        icon: "ion:close",
        className: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500",
        text: "Lorem ipsum dolor sit amet, consectetur.",
      },
      {
        icon: "ion:close",
        className: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500",
        text: "Only lorem.",
      },
      {
        icon: "ion:close",
        className: "bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-500",
        text: "Lorem ipsum dolor.",
      },
    ],
  },
];

const PricingPage = () => {
  const [check, setCheck] = useState(true);
  const toggle = () => {
    setCheck(!check);
  };

  return (
    <div>
      <div className="space-y-5">
        <div className="text-center mb-6">
          <h4 className="text-gray-900 text-xl font-medium mb-2">Packages</h4>
          <label className="inline-flex text-sm cursor-pointer">
            <input type="checkbox" onChange={toggle} hidden />
            <span
              className={` ${
                check
                  ? "bg-indigo-500/10  text-indigo-500"
                  : "dark:text-gray-300"
              } 
                px-[18px] py-1 transition duration-100 rounded`}
            >
              Yearly
            </span>
            <span
              className={`
              ${
                !check
                  ? "bg-indigo-500/10  text-indigo-500"
                  : " dark:text-gray-300"
              }
                px-[18px] py-1 transition duration-100 rounded
                `}
            >
              Monthly
            </span>
          </label>
        </div>
        <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5 lg:gap-6 mx-auto">
          {tables.map((item, i) => (
            <div
              className="card p-6 text-center group hover:-translate-y-1 transition-all duration-200 relative overflow-hidden z-[1]"
              key={i}
            >
              {item.ribon && (
                <div className="text-sm font-medium bg-indigo-500 text-white py-2 text-center absolute ltr:-right-[43px] rtl:-left-[43px] top-6 px-10 transform ltr:rotate-[45deg] rtl:-rotate-45">
                  {item.ribon}
                </div>
              )}
              <Icon
                icon={item.icon}
                className=" text-center text-7xl mx-auto text-indigo-500 mb-4 group-hover:scale-110 transition-all duration-300"
              />
              <h4 className=" text-xl text-gray-600 dark:text-gray-300 mb-1">
                {item.title}
              </h4>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                the starter choise
              </div>
              <div
                className={`relative   text-sm text-gray-500 dark:text-gray-400 mt-5 `}
              >
                {check ? (
                  <span className=" text-4xl tracking-tight  text-indigo-500">
                    {item.price_Yearly}
                  </span>
                ) : (
                  <span className="text-4xl tracking-tight  text-indigo-500">
                    {item.price_Monthly}
                  </span>
                )}
                /{check ? "year" : "month"}
              </div>
              {item?.child && (
                <ul className="mt-8 space-y-4 text-left">
                  {item?.child.map((subItem, j) => (
                    <li
                      className="flex items-start space-x-3 rtl:space-x-reverse"
                      key={j}
                    >
                      <div
                        className={`shrink-0 h-6 w-6  flex flex-col items-center justify-center rounded-full ${subItem.className}`}
                      >
                        <Icon icon={subItem.icon} className="text-lg" />
                      </div>
                      <div className="  text-sm text-gray-600 dark:text-gray-300 ">
                        {subItem.text}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6">
                <Button
                  text={item.button}
                  className={` w-full rounded-full ${
                    item.bg === "bg-indigo-500"
                      ? "btn-primary"
                      : "btn-primary light"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5 lg:gap-6 mx-auto">
          {tables.map((item, i) => (
            <div
              className="card p-6 text-center group hover:-translate-y-1 transition-all duration-200 relative z-[1] overflow-hidden"
              key={i}
            >
              <Icon
                icon={item.icon}
                className=" text-center text-7xl mx-auto text-indigo-500 mb-4 group-hover:scale-110 transition-all duration-300"
              />
              <h4 className=" text-xl text-gray-600 dark:text-gray-300 mb-1">
                {item.title}
              </h4>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                the starter choise
              </div>
              <div
                className={`relative   text-sm text-gray-500 dark:text-gray-400 mt-5 `}
              >
                {check ? (
                  <span className=" text-4xl tracking-tight  text-indigo-500">
                    {item.price_Yearly}
                  </span>
                ) : (
                  <span className="text-4xl tracking-tight  text-indigo-500">
                    {item.price_Monthly}
                  </span>
                )}
                /{check ? "year" : "month"}
              </div>
              {item?.child && (
                <ul className="mt-8 space-y-4 text-left">
                  {item?.child.map((subItem, j) => (
                    <li
                      className="flex items-start space-x-3 rtl:space-x-reverse"
                      key={j}
                    >
                      <div
                        className={`shrink-0 h-6 w-6  flex flex-col items-center justify-center rounded-full ${subItem.className}`}
                      >
                        <Icon icon={subItem.icon} className="text-lg" />
                      </div>
                      <div className="  text-sm text-gray-600 dark:text-gray-300 ">
                        {subItem.text}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6">
                <Button
                  text={item.button}
                  className={` w-full rounded-full ${
                    item.bg === "bg-indigo-500"
                      ? "btn-primary"
                      : "btn-primary light"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
