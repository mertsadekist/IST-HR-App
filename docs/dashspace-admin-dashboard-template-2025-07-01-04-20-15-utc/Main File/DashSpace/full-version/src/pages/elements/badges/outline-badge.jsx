import React from "react";
import Badge from "@/components/ui/Badge";
const OutlineBadge = () => {
  return (
    <div className="space-xy">
      <Badge
        label="primary"
        className="border-indigo-500 text-indigo-500 border rounded-full"
      />
      <Badge
        label="secondary"
        className=" border-fuchsia-500 text-fuchsia-500 border rounded-full"
      />
      <Badge
        label="danger"
        className="border-red-500 text-red-500 border rounded-full"
      />
      <Badge
        label="success"
        className="border-green-500 text-green-500 border rounded-full"
      />
      <Badge
        label="info"
        className="border-green-500 text-green-500 border rounded-full"
      />
      <Badge
        label="warning"
        className="border-yellow-500 text-yellow-500 border rounded-full"
      />
      <Badge
        label="Dark"
        className="border-gray-800 text-gray-800 border rounded-full"
      />
      <Badge
        label="light"
        className="border-gray-200 text-gray-700 border rounded-full"
      />
    </div>
  );
};

export default OutlineBadge;
