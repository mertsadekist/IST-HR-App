import React, { useEffect } from "react";
import Avatar from "@/components/ui/Avatar";
import clsx from "clsx";
import { formatTime } from "@/utility";

const ContactList = ({ contact, openChat, selectedChatId }) => {
  const { avatar, id, fullName, status, about, chat } = contact;

  return (
    <div
      className={clsx(
        "flex space-x-3 rtl:space-x-reverse cursor-pointer  items-start  p-4   transition-all duration-150 ",
        {
          "bg-indigo-500 hover:bg-indigo-500": id === selectedChatId,
          "hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:bg-opacity-70":
            id !== selectedChatId,
        }
      )}
      onClick={() => openChat(id)}
    >
      <Avatar
        src={avatar}
        dot
        className="h-9 w-9"
        dotClass={status === "online" ? "bg-indigo-500" : "bg-gray-500"}
      />
      <div className="flex-1 overflow-hidden md:block hidden">
        <span
          className={clsx("block  text-sm  truncate mb-0.5", {
            "text-white": id === selectedChatId,
            "text-gray-600 dark:text-gray-300": id !== selectedChatId,
          })}
        >
          {fullName}
        </span>
        <span
          className={clsx("text-xs truncate  block", {
            "text-gray-300": id === selectedChatId,
            " text-gray-400  dark:text-gray-400": id !== selectedChatId,
          })}
        >
          {chat?.lastMessage ? chat?.lastMessage : about}
        </span>
      </div>
      <div
        className={clsx("block text-xs  font-normal text-right md:block ", {
          "text-gray-300": id === selectedChatId,
          " text-gray-400 dark:text-gray-400": id !== selectedChatId,
        })}
      >
        <span>
          {chat?.lastMessageTime ? formatTime(chat?.lastMessageTime) : ""}
        </span>
      </div>
    </div>
  );
};

export default ContactList;
