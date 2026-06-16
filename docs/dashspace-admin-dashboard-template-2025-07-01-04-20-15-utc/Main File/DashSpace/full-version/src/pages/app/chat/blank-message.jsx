import React from "react";
import Icon from "@/components/ui/Icon";

const BlankMessage = () => {
  return (
    <div className="text-center space-y-1">
      <Icon
        icon="ph:wechat-logo-light"
        className="text-gray-500 dark:text-gray-400 text-7xl mx-auto"
      />
      <div className="text-2xl text-gray-600 dark:text-gray-300 font-medium">
        No chat selected
      </div>
      <div className="text-sm text-gray-500 ">
        don't worry, just take a deep breath & say "Hello"
      </div>
    </div>
  );
};

export default BlankMessage;
