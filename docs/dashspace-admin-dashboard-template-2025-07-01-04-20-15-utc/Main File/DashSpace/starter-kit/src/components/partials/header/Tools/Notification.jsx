import React from "react";
import Dropdown from "@/components/ui/Dropdown";
import Icon from "@/components/ui/Icon";
import { Link } from "react-router-dom";
import { Menu } from "@headlessui/react";
import { notifications } from "@/mocks/data";
const notifyLabel = () => {
  return (
    <span className="relative   ">
      <svg
        width="24"
        height="25"
        viewBox="0 0 24 25"
        fill="none"
        className=""
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 18.8476C17.6392 18.8476 20.2481 18.1242 20.5 15.2205C20.5 12.3188 18.6812 12.5054 18.6812 8.94511C18.6812 6.16414 16.0452 3 12 3C7.95477 3 5.31885 6.16414 5.31885 8.94511C5.31885 12.5054 3.5 12.3188 3.5 15.2205C3.75295 18.1352 6.36177 18.8476 12 18.8476Z"
          className=" stroke-gray-600 dark:stroke-gray-100"
          strokeWidth="1.5"
          strokeLinecap="round"
        ></path>
        <path
          d="M14.3889 21.8572C13.0247 23.372 10.8967 23.3899 9.51953 21.8572"
          className=" stroke-gray-600 dark:stroke-gray-100"
          strokeWidth="1.5"
          strokeLinecap="round"
        ></path>
        <circle
          cx="17"
          cy="5"
          r="4.5"
          className=" fill-red-500 hidden"
          stroke="white"
        ></circle>
      </svg>
      <span className=" absolute right-1 top-0 flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 ring-1 ring-white"></span>
      </span>
    </span>
  );
};

const Notification = () => {
  return (
    <div className="md:block hidden">
      <Dropdown classMenuItems="md:w-[360px] top-[30px]" label={notifyLabel()}>
        <div className="flex justify-between px-4 py-4 border-b border-gray-10 dark:border-gray-600">
          <div className="text-sm text-gray-800 dark:text-gray-200 font-semibold leading-6">
            Recent Notification
          </div>
        </div>
        <div className="divide-y divide-gray-10 dark:divide-gray-800">
          {notifications?.map((item, i) => (
            <Menu.Item key={i}>
              {({ active }) => (
                <div
                  className={`${
                    active
                      ? "bg-gray-100 dark:bg-gray-700 dark:bg-opacity-70 text-gray-800"
                      : "text-gray-600 dark:text-gray-300"
                  } block w-full px-4 py-2 text-sm  cursor-pointer group`}
                >
                  <div className="flex ltr:text-left rtl:text-right">
                    <div className="flex-none ltr:mr-4 rtl:ml-4">
                      <div
                        className={`   h-10 w-10 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-all duration-200  text-white
                      
                    ${item.status === "cyan" ? "bg-cyan-500 " : ""} 
                       ${item.status === "blue" ? "bg-indigo-500 " : ""} 
                      ${item.status === "red" ? "bg-red-500 " : ""} 
                      ${item.status === "green" ? "bg-green-500 " : ""}${
                          item.status === "yellow" ? "bg-yellow-500 " : ""
                        }
                      
                      `}
                      >
                        <Icon icon={item.icon} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div
                        className={`${
                          active
                            ? "text-gray-600 dark:text-gray-300"
                            : " text-gray-600 dark:text-gray-300"
                        } text-sm`}
                      >
                        <div
                          dangerouslySetInnerHTML={{ __html: item.title }}
                        ></div>
                      </div>

                      <div className="text-gray-400 dark:text-gray-400 text-xs mt-1 text-light">
                        2 days ago
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Menu.Item>
          ))}
        </div>
        <div className=" text-center mb-3 mt-1 ">
          <Link
            to="/notifications"
            className="text-sm text-indigo-500  hover:underline transition-all duration-150 "
          >
            View all
          </Link>
        </div>
      </Dropdown>
    </div>
  );
};

export default Notification;
