import React from "react";
import Badge from "@/components/ui/Badge";
const SoftColorBadge = () => {
  return (
    <div className="space-xy">
      <Badge
        label="primary"
        className="bg-indigo-500 text-indigo-700 bg-opacity-10"
      />
      <Badge
        label="secondary"
        className="bg-fuchsia-500 text-fuchsia-500 bg-opacity-10"
      />
      <Badge label="danger" className="bg-red-500 text-red-600 bg-opacity-10" />
      <Badge
        label="success"
        className="bg-green-500 text-green-600 bg-opacity-10"
      />
      <Badge label="info" className="bg-cyan-500 text-cyan-600 bg-opacity-10" />
      <Badge
        label="warning"
        className="bg-yellow-500 text-yellow-400 bg-opacity-10"
      />
    </div>
  );
};

export default SoftColorBadge;
