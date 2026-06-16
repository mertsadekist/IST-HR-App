import React, { useState, useRef, useEffect } from "react";

const Bar = ({ value, className, showValue, striped, animate, active }) => {
  // striped style

  return (
    <div
      className={`flex flex-col text-center whitespace-nowrap justify-center h-full progress-bar relative  ${className} ${
        striped ? "stripes" : ""
      }
      ${animate ? "animate-stripes" : ""}
      ${active ? "animate-active" : ""}
      `}
      style={{ width: `${value}%` }}
    >
      {showValue && (
        <span className="text-[10px] text-white font-bold">{value + "%"}</span>
      )}
    </div>
  );
};

export default Bar;
