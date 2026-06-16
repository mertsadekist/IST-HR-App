import React from "react";
import Badge from "@/components/ui/Badge";
const BadgeWithIcon = () => {
  return (
    <div className="space-xy">
      <Badge
        label="primary"
        className="bg-indigo-500 text-white "
        icon="ph:star-four"
      />
      <Badge
        label="secondary"
        className="bg-fuchsia-500 text-white"
        icon="ph:arrow-circle-up"
      />
      <Badge
        label="danger"
        className="bg-red-500 text-white"
        icon="ph:cloud-arrow-down"
      />
      <Badge
        label="success"
        className="bg-green-500 text-white"
        icon="ph:trend-up"
      />
      <Badge label="info" className="bg-cyan-500 text-white" icon="ph:info" />
      <Badge
        label="warning"
        className="bg-yellow-500 text-white"
        icon="ph:star-four"
      />
      <Badge
        label="Dark"
        className="bg-gray-800 dark:bg-gray-900 text-white"
        icon="ph:star-four"
      />
    </div>
  );
};

export default BadgeWithIcon;
