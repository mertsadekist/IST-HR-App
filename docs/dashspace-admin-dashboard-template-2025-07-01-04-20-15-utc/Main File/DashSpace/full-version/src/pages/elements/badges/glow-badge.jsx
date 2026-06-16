import React from "react";
import Badge from "@/components/ui/Badge";
const GlowBadge = () => {
  return (
    <div className="space-xy">
      <Badge
        label="primary"
        className="bg-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/50"
      />
      <Badge
        label="secondary"
        className="bg-fuchsia-500 text-white hover:shadow-lg hover:shadow-fuchsia-500/50"
      />
      <Badge
        label="success"
        className=" bg-green-500 text-white hover:shadow-lg hover:shadow-green-500/50"
      />
      <Badge
        label="info"
        className=" bg-cyan-500 text-white hover:shadow-lg hover:shadow-cyan-500/50"
      />
      <Badge
        label="warning"
        className=" bg-yellow-500 text-white hover:shadow-lg hover:shadow-yellow-500/50"
      />
      <Badge
        label="error"
        className=" bg-red-500 text-white hover:shadow-lg hover:shadow-red-500/50"
      />
      <Badge
        label="Dark"
        className="bg-gray-800 text-white hover:shadow-lg hover:shadow-gray-800/20"
      />
      <Badge
        label="Light"
        className=" bg-gray-200 text-gray-700 hover:shadow-lg hover:shadow-gray-400/30"
      />
    </div>
  );
};

export default GlowBadge;
