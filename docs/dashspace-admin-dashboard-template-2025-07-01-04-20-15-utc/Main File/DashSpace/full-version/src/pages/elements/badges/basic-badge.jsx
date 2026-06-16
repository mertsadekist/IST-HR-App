import React from "react";
import Badge from "@/components/ui/Badge";
const BasicBadge = () => {
  return (
    <div className="space-xy">
      <Badge label="primary" className="bg-indigo-500 text-white" />
      <Badge label="secondary" className="bg-fuchsia-500 text-white" />
      <Badge label="danger" className="bg-red-500 text-white" />
      <Badge label="success" className="bg-green-500 text-white" />
      <Badge label="info" className="bg-cyan-500 text-white" />
      <Badge label="warning" className="bg-yellow-500 text-white" />
      <Badge
        label="Dark"
        className="bg-gray-800 dark:bg-gray-900  text-white"
      />
      <Badge label="light" className="bg-gray-200 text-gray-700" />
    </div>
  );
};

export default BasicBadge;
