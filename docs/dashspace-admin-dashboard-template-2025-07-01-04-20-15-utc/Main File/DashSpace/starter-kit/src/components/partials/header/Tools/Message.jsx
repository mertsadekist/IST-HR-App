import React from "react";
import Dropdown from "@/components/ui/Dropdown";
import Icon from "@/components/ui/Icon";
import { Link } from "react-router-dom";
import { Menu } from "@headlessui/react";
import { message } from "@/mocks/data";

const messagelabel = () => {
  return (
    <span className="relative text-gray-600 text-xl dark:text-gray-100 ">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="21.681"
        height="21.681"
        viewBox="0 0 21.681 21.681"
      >
        <g id="Chat" transform="translate(0.931 0.75)">
          <path
            id="Stroke_4"
            data-name="Stroke 4"
            d="M17.071,17.07a10.006,10.006,0,0,1-11.285,2,4.048,4.048,0,0,0-1.421-.4c-1.187.007-2.664,1.158-3.432.391s.384-2.246.384-3.44a3.994,3.994,0,0,0-.391-1.414A10,10,0,1,1,17.071,17.07Z"
            transform="translate(0)"
            fill="none"
            className=" stroke-gray-600 dark:stroke-gray-100"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="1.5"
          ></path>
          <path
            id="Stroke_11"
            data-name="Stroke 11"
            d="M.5.5H.5"
            transform="translate(13.444 9.913)"
            fill="#fff"
            className=" stroke-gray-600 dark:stroke-gray-100"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="2"
          ></path>
          <path
            id="Stroke_13"
            data-name="Stroke 13"
            d="M.5.5H.5"
            transform="translate(9.435 9.913)"
            fill="#fff"
            className=" stroke-gray-600 dark:stroke-gray-100"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="2"
          ></path>
          <path
            id="Stroke_15"
            data-name="Stroke 15"
            d="M.5.5H.5"
            transform="translate(5.426 9.913)"
            fill="#fff"
            className=" stroke-gray-600 dark:stroke-gray-100"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="2"
          ></path>
          <circle
            cx="17"
            cy="5"
            r="4.5"
            className=" fill-red-500 hidden"
            stroke="white"
          ></circle>
        </g>
      </svg>
      <span className=" absolute -right-[2px] top-1 flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 ring-1 ring-white"></span>
      </span>
    </span>
  );
};
// message slice  0-4
const newMessage = message.slice(0, 4);

const Message = () => {
  return (
    <div className="md:block hidden">
      <Dropdown
        classMenuItems="md:w-[360px] w-min top-[30px]"
        label={messagelabel()}
      >
        <div className="flex justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-600">
          <div className="text-sm text-gray-800 dark:text-gray-200 font-semibold leading-6">
            Messages
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {newMessage?.map((item, i) => (
            <Menu.Item key={i}>
              {({ active }) => (
                <div
                  className={`${
                    active
                      ? "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:bg-opacity-70"
                      : "text-gray-600 dark:text-gray-300"
                  } block w-full px-4 py-2 text-sm  cursor-pointer group`}
                >
                  <div className="flex ltr:text-left rtl:text-right space-x-3 rtl:space-x-reverse">
                    <div className="flex-none">
                      <div className="h-12 w-12 bg-white dark:bg-gray-700 rounded-full relative  group-hover:scale-110 transition-all duration-200">
                        <span
                          className={`${
                            item.active ? "bg-gray-400" : "bg-green-500"
                          } w-[10px] h-[10px] rounded-full border border-white dark:border-gray-700  inline-block absolute right-0 top-0`}
                        ></span>
                        <img
                          src={item.image}
                          alt=""
                          className="block w-full h-full object-cover rounded-full border hover:border-white border-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-gray-800 dark:text-gray-300 text-sm font-medium mb-1">
                        {item.title}
                      </div>
                      <div className="text-sm hover:text-[#68768A] text-gray-600 dark:text-gray-300 mb-1 w-full truncate">
                        {item.desc}
                      </div>
                      <div className="text-gray-400 dark:text-gray-400 text-xs font-light">
                        3 min ago
                      </div>
                    </div>
                    {item.hasnotifaction && (
                      <div className="flex-0  self-center">
                        <span className="h-3 w-3 bg-indigo-500 border border-white rounded-full text-[10px] flex items-center justify-center text-white"></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Menu.Item>
          ))}
        </div>

        <div className=" text-center mb-3 mt-1 ">
          <Link
            to="/chat"
            className="text-sm text-indigo-500  hover:underline transition-all duration-150 "
          >
            View all
          </Link>
        </div>
      </Dropdown>
    </div>
  );
};

export default Message;
