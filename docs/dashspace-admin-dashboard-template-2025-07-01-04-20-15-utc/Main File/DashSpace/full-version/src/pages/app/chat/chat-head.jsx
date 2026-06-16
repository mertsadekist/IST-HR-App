import React from "react";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";

const ChatHead = ({ contact }) => {
  return (
    <header className="border-b border-gray-200 dark:border-gray-700  bg-white dark:bg-gray-800 rounded-tr-md">
      <div className="flex py-3 px-3 items-center">
        <div className="flex-1">
          <div className="flex space-x-3 rtl:space-x-reverse">
            <div className=" flex-none">
              <Avatar
                src={contact?.avatar}
                dot
                className="h-10 w-10"
                dotClass={
                  contact?.status === "online" ? "bg-indigo-500" : "bg-gray-500"
                }
              />
            </div>
            <div className="flex-1 text-start">
              <div>{contact?.fullName}</div>
              <div className="block text-gray-500 dark:text-gray-300 text-xs font-normal">
                {contact?.status === "online" ? "Active" : "Offline"}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-none flex md:space-x-3 space-x-1 items-center rtl:space-x-reverse">
          <button className="icon-btn  w-9 h-9 rounded-full text-xl">
            <Icon icon="ph:phone-call" />
          </button>
          <button className="icon-btn w-9 h-9 rounded-full text-xl ">
            <Icon icon="ph:camera" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default ChatHead;
