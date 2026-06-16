import React from "react";
import Icon from "@/components/ui/Icon";
import { motion } from "framer-motion";
const Checkbox = ({
  id,
  disabled,
  label,
  value,
  name,
  onChange,
  activeClass = "bg-indigo-500 dark:bg-gray-700 border-indigo-500 ",
  className = "checkbox-className group-hover:border-indigo-500 ",
  indeterminate,
}) => {
  return (
    <label
      className={`flex items-center group  ${
        disabled ? " cursor-not-allowed " : "cursor-pointer"
      }`}
      id={id}
    >
      <input
        type="checkbox"
        className="hidden"
        name={name}
        checked={value}
        onChange={onChange}
        htmlFor={id}
        disabled={disabled}
        indeterminate={indeterminate}
      />
      <span
        className={`h-5 w-5 border flex-none  dark:border-gray-800   checkbox-control  items-center justify-center text-white
        inline-flex ltr:mr-3 rtl:ml-3 relative transition-all duration-200 group-hover:shadow-checkbox rounded
        ${
          value
            ? activeClass
            : "bg-gray-50 group-hover:bg-white  dark:bg-gray-600 dark:border-gray-600 border-gray-10"
        } ${className} ${disabled ? " opacity-50" : ""}
        `}
      >
        <motion.span
          animate={{ scale: value ? 1.2 : 1 }}
          transition={{ duration: 0.5 }}
        >
          <Icon
            icon="fa6-solid:check"
            className={`text-[12px] transition-all duration-100 ${
              value ? "scale-100" : "scale-0"
            }`}
          />
        </motion.span>
      </span>
      <span className="text-gray-500 dark:text-gray-400 text-sm leading-6">
        {label}
      </span>
    </label>
  );
};

export default Checkbox;
