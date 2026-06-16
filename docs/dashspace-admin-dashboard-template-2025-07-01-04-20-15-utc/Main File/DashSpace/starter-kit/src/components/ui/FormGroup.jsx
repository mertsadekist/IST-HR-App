import React, { Children } from "react";
import Icon from "@/components/ui/Icon";

const FormGroup = ({
  label,
  classLabel = "form-label",
  className = "",
  error,
  id,
  horizontal,
  validate,
  msgTooltip,
  description,

  children,
}) => {
  return (
    <div
      className={`textfiled-wrapper  ${error ? "is-error" : ""}  ${
        horizontal ? "flex" : ""
      }  ${validate ? "is-valid" : ""} ${className} `}
    >
      {label && (
        <label
          htmlFor={id}
          className={`block capitalize ${classLabel}  ${
            horizontal ? "flex-0 mr-6 md:w-[100px] w-[60px] break-words" : ""
          }`}
        >
          {label}
        </label>
      )}
      <div className={`relative ${horizontal ? "flex-1" : ""}`}>
        {children}

        {/* icon */}

        <div className="flex text-xl absolute ltr:right-[14px] rtl:left-[14px] top-1/2 -translate-y-1/2  space-x-1 rtl:space-x-reverse">
          {error && (
            <span className="text-red-600">
              <Icon icon="heroicons-outline:information-circle" />
            </span>
          )}
          {validate && (
            <span className="text-green-600">
              <Icon icon="bi:check-lg" />
            </span>
          )}
        </div>
      </div>
      {/* error and success message*/}
      {error && (
        <div
          className={` mt-2 ${
            msgTooltip
              ? " inline-block bg-red-600 text-white text-[10px] px-2 py-1 rounded"
              : " text-red-600 block text-sm"
          }`}
        >
          {error.message}
        </div>
      )}
      {/* validated and success message*/}
      {validate && (
        <div
          className={` mt-2 ${
            msgTooltip
              ? " inline-block bg-green-600 text-white text-[10px] px-2 py-1 rounded"
              : " text-green-600 block text-sm"
          }`}
        >
          {validate}
        </div>
      )}
      {/* only description */}
      {description && <span className="input-help">{description}</span>}
    </div>
  );
};

export default FormGroup;
