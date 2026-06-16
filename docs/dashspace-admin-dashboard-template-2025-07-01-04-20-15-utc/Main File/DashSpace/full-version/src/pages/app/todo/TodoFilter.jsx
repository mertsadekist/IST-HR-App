import React from "react";
import { filterOptions } from "@/mocks/data";

const TodoFilter = ({ handleFilterChange, filter }) => {
  const firstRow = filterOptions.slice(0, 3);
  const secondRow = filterOptions.slice(3);

  const getButtonClassName = (option) => {
    let className =
      "transition-all duration-200 inline-flex items-center space-x-1 rtl:space-x-reverse";

    if (option.value === filter) {
      switch (option.value) {
        case "team":
          className += " text-red-500";
          break;
        case "low":
          className += " text-green-500";
          break;
        case "medium":
          className += " text-yellow-500";
          break;
        case "high":
          className += " text-indigo-500";
          break;
        case "update":
          className += " text-cyan-500";
          break;
        default:
          break;
      }
    }

    return className;
  };

  const getButtonSpanClassName = (option) => {
    let className =
      "w-2 h-2 rounded-full inline-block transition-all duration-150";

    if (option.value === filter) {
      switch (option.value) {
        case "team":
          className += " bg-red-500";
          break;
        case "low":
          className += " bg-green-500";
          break;
        case "medium":
          className += " bg-yellow-500";
          break;
        case "high":
          className += " bg-indigo-500";
          break;
        case "update":
          className += " bg-cyan-500";
          break;
        default:
          break;
      }
    }

    return className;
  };

  return (
    <li className="sticky top-0 p-6 bg-white/10 backdrop-blur-md rounded-t-md dark:bg-gray-800/10 z-[1] flex justify-between">
      <div className="text-sm space-x-3 rtl:space-x-reverse">
        {firstRow.map((option) => (
          <button
            key={option.value}
            className={
              option.value === filter ? "text-indigo-500 font-medium" : ""
            }
            onClick={() => handleFilterChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="text-sm space-x-3 rtl:space-x-reverse">
        {secondRow.map((option) => (
          <button
            key={option.value}
            className={getButtonClassName(option)}
            onClick={() => handleFilterChange(option.value)}
          >
            <span className={getButtonSpanClassName(option)}></span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </li>
  );
};

export default TodoFilter;
