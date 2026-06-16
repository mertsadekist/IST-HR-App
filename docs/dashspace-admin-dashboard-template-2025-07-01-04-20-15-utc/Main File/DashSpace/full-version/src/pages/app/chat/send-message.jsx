import React, { useState } from "react";
import Icon from "@/components/ui/Icon";

const SendMessage = ({ handleSendMessage }) => {
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setMessage(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(message);
    setMessage("");
  };
  return (
    <footer className="md:px-6 px-4 sm:flex md:space-x-4 sm:space-x-2 rtl:space-x-reverse border-t md:pt-6 pt-4 border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex-none sm:flex hidden md:space-x-3 space-x-1 rtl:space-x-reverse">
        <div className="text-xl text-indigo-500 cursor-pointer ">
          <Icon icon="heroicons-outline:link" />
        </div>
        <div className=" text-xl text-indigo-500 cursor-pointer">
          <Icon icon="heroicons-outline:emoji-happy" />
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex-1 relative flex space-x-3 rtl:space-x-reverse"
      >
        <div className="flex-1">
          <textarea
            type="text"
            value={message}
            onChange={handleChange}
            placeholder="Type your message..."
            className="focus:ring-0 focus:outline-0 block w-full bg-transparent dark:text-white resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
        </div>
        <div className="flex-none md:pr-0 pr-3">
          <button
            type="submit"
            className="h-8 w-8 bg-indigo-500 text-white flex flex-col justify-center items-center text-lg rounded-full"
          >
            <Icon
              icon="heroicons-outline:paper-airplane"
              className="transform rotate-[60deg]"
            />
          </button>
        </div>
      </form>
    </footer>
  );
};

export default SendMessage;
