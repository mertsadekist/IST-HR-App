import React from "react";

const Radio = ({
  label,
  id,
  name,
  disabled,
  value,
  onChange,
  activeClass = "ring-offset-indigo-500  dark:border-indigo-500 dark:ring-offset-indigo-500 ",
  wrapperClass = " ",
  labelClass = "text-gray-500 dark:text-gray-400 text-sm leading-6",
  checked,
  className = "radio-className group-hover:border-indigo-500 ",
}) => {
  return (
    <div>
      <label className={`flex items-center group ` + wrapperClass} id={id}>
        <input
          type="radio"
          className="hidden"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          htmlFor={id}
          disabled={disabled}
        />
        <span
          className={` flex-none   dark:bg-gray-500 rounded-full border inline-flex h-5 w-5  ltr:mr-3 rtl:ml-3 relative transition-all duration-200 
          group-hover:shadow-checkbox  
          ${className}
          ${disabled ? " cursor-not-allowed opacity-50" : "cursor-pointer "}
          ${
            checked
              ? activeClass +
                " ring-white ring dark:ring-[4px] ring-inset  ring-offset-[5px] "
              : "bg-gray-50 group-hover:bg-white  dark:group-hover:bg-gray-800  dark:bg-gray-600 dark:border-gray-600 border-gray-10 "
          }
          `}
        ></span>
        {label && <span className={labelClass}>{label}</span>}
      </label>
    </div>
  );
};

export default Radio;
