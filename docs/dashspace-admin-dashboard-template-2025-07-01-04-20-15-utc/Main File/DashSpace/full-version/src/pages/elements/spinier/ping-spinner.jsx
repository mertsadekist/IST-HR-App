import React from "react";

const PingSpinner = () => {
  return (
    <div className="space-xy flex  flex-wrap">
      <span className="relative flex h-5 w-5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-full w-full bg-indigo-500"></span>
      </span>
      <span className="relative flex h-5 w-5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-full w-full bg-fuchsia-500"></span>
      </span>
      <span className="relative flex h-5 w-5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-full w-full bg-cyan-500"></span>
      </span>
      <span className="relative flex h-5 w-5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-full w-full bg-green-500"></span>
      </span>
      <span className="relative flex h-5 w-5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-full w-full bg-yellow-500"></span>
      </span>
      <span className="relative flex h-5 w-5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-full w-full bg-red-500"></span>
      </span>
      <span className="relative flex h-5 w-5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-full w-full bg-gray-500"></span>
      </span>
    </div>
  );
};

export default PingSpinner;
