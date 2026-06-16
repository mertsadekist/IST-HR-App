import React from "react";
import Avatar from "@/components/ui/Avatar";
import Dropdown from "@/components/ui/Dropdown";
import Icon from "@/components/ui/Icon";
import { formatTime } from "@/utility";
const chatAction = [
  {
    label: "Remove",
    link: "#",
  },
  {
    label: "Forward",
    link: "#",
  },
];

const MessageList = ({ message, contact, profile }) => {
  const { senderId, message: chatMessage, time } = message;
  const { avatar } = contact;

  return (
    <>
      {/* <li className={senderId === 11 ? "me" : "sender"}>{chatMessage}</li>  */}
      <li className="block md:px-6 px-4">
        {senderId === 11 ? (
          <div className="flex space-x-2 items-start justify-end group w-full rtl:space-x-reverse">
            <div className="no flex space-x-4 rtl:space-x-reverse">
              <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible">
                <Dropdown
                  classMenuItems=" w-[100px] left-0 top-0  "
                  items={chatAction}
                  label={
                    <div className="h-8 w-8 bg-indigo-100 dark:bg-gray-900 dark:text-gray-400 flex flex-col justify-center items-center text-xl rounded-full text-indigo-500">
                      <Icon icon="heroicons-outline:dots-horizontal" />
                    </div>
                  }
                />
              </div>

              <div className="whitespace-pre-wrap break-all">
                <div className="text-contrent p-3 bg-indigo-500  text-white text-sm font-normal rounded-md flex-1 mb-1">
                  {chatMessage}
                </div>
                <span className="font-normal text-xs text-gray-400">
                  {formatTime(time)}
                </span>
              </div>
            </div>
            <div className="flex-none">
              <div className="h-8 w-8 rounded-full">
                <img
                  src={profile?.profileUser?.avatar}
                  alt=""
                  className="block w-full h-full object-cover rounded-full"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex space-x-2 items-start group rtl:space-x-reverse ">
            <div className="flex-none">
              <div className="h-8 w-8 rounded-full">
                <img
                  src={avatar}
                  alt=""
                  className="block w-full h-full object-cover rounded-full"
                />
              </div>
            </div>
            <div className="flex-1 flex space-x-4 rtl:space-x-reverse">
              <div>
                <div className="text-contrent p-3 bg-indigo-100 dark:bg-gray-600 dark:text-gray-300 text-gray-600 text-sm font-normal mb-1 rounded-md flex-1 whitespace-pre-wrap break-all">
                  {chatMessage}
                </div>
                <span className="font-normal text-xs text-gray-400 dark:text-gray-400">
                  {formatTime(time)}
                </span>
              </div>
              <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible">
                <Dropdown
                  classMenuItems=" w-[100px] top-0"
                  items={chatAction}
                  label={
                    <div className="h-8 w-8 bg-indigo-50 dark:bg-gray-600 dark:text-gray-300 text-indigo-400 flex flex-col justify-center items-center text-xl rounded-full">
                      <Icon icon="heroicons-outline:dots-horizontal" />
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        )}
      </li>
    </>
  );
};

export default MessageList;
