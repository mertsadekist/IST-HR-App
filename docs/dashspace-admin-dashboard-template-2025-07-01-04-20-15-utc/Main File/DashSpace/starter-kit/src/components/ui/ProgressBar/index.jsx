import React from "react";
import Bar from "./Bar";
const ProgressBar = ({
  title,
  children,
  value,
  backClass = "rounded-full",
  className = "bg-gray-900 dark:bg-gray-900",
  titleClass = "text-base font-normal",
  striped,
  animate,
  active,
  showValue,
}) => {
  return (
    <div className="relative">
      {title && (
        <span
          className={`block text-gray-500   tracking-[0.01em] mb-2 ${titleClass}`}
        >
          {title}
        </span>
      )}
      {
        // if no children, then show the progress bar
        !children && (
          <div
            className={`w-full  overflow-hidden bg-opacity-10 progress  ${backClass}`}
          >
            <Bar
              value={value}
              className={className}
              striped={striped}
              animate={animate}
              active={active}
              showValue={showValue}
            />
          </div>
        )
      }
      {
        // if children, then show the progress bar with children
        children && (
          <div
            className={`w-full  overflow-hidden bg-opacity-10 flex progress  ${backClass}`}
          >
            {children}
          </div>
        )
      }
    </div>
  );
};

export default ProgressBar;
