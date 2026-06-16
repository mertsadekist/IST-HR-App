import React, { Fragment } from "react";
import Icon from "@/components/ui/Icon";
import { Link } from "react-router-dom";
import { Menu } from "@headlessui/react";
import { notifications } from "@/mocks/data";
import Card from "@/components/ui/Card";
const NotificationPage = () => {
  return (
    <div>
      <Card bodyClass="p-0">
        <div className="flex justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-600">
          <div className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-6">
            All Notifications
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <Menu as={Fragment}>
            {notifications?.map((item, i) => (
              <Menu.Item key={i}>
                {({ active }) => (
                  <div
                    className={`${
                      active
                        ? "bg-gray-100 dark:bg-gray-700 dark:bg-opacity-70 text-gray-800"
                        : "text-gray-600 dark:text-gray-300"
                    } block w-full px-4 py-2 text-sm  cursor-pointer`}
                  >
                    <div className="flex ltr:text-left rtl:text-right">
                      <div className="flex-none ltr:mr-3 rtl:ml-3">
                        <div className="h-8 w-8 bg-white rounded-full">
                          <img
                            src={item.image}
                            alt=""
                            className={`${
                              active ? " border-white" : " border-transparent"
                            } block w-full h-full object-cover rounded-full border`}
                          />
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
                          {item.title}
                        </div>
                        <div
                          className={`${
                            active
                              ? "text-gray-500 dark:text-gray-200"
                              : " text-gray-600 dark:text-gray-300"
                          } text-xs leading-4`}
                        >
                          {item.desc}
                        </div>
                        <div className="text-gray-400 dark:text-gray-400 text-xs mt-1">
                          3 min ago
                        </div>
                      </div>
                      {item.unread && (
                        <div className="flex-0">
                          <span className="h-[10px] w-[10px] bg-red-600 border border-white dark:border-gray-400 rounded-full inline-block"></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Menu.Item>
            ))}
          </Menu>
        </div>
      </Card>
    </div>
  );
};

export default NotificationPage;
