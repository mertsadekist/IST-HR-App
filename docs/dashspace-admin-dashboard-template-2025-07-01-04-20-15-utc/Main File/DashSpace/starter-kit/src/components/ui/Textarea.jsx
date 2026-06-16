import React from "react";
import Icon from "@/components/ui/Icon";
const Textarea = ({
  label,
  placeholder,
  classLabel = "form-label",
  className = "",
  classGroup = "",
  register,
  name,
  readonly,
  dvalue,
  error,
  icon,
  disabled,
  id,
  horizontal,
  validate,
  description,
  cols,
  row = 3,
  onChange,
  ...rest
}) => {
  return (
    <div
      className={`textfiled-wrapper  ${error ? "is-error" : ""}  ${
        horizontal ? "flex" : ""
      }  ${validate ? "is-valid" : ""} `}
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
        {name && (
          <textarea
            {...register(name)}
            {...rest}
            className={`${
              error ? " is-error" : " "
            } text-control py-2 ${className}  `}
            placeholder={placeholder}
            readOnly={readonly}
            disabled={disabled}
            id={id}
            cols={cols}
            rows={row}
            onChange={onChange}
          ></textarea>
        )}
        {!name && (
          <textarea
            className={`${
              error ? " is-error" : " "
            } text-control py-2 ${className}  `}
            placeholder={placeholder}
            readOnly={readonly}
            disabled={disabled}
            id={id}
            cols={cols}
            rows={row}
            onChange={onChange}
          ></textarea>
        )}

        {/* icon */}
        <div className="flex text-xl absolute ltr:right-[14px] rtl:left-[14px] top-1/2 -translate-y-1/2  space-x-1 rtl:space-x-reverse">
          {error && (
            <span className="text-red-500">
              <Icon icon="ph:info-fill" />
            </span>
          )}
          {validate && (
            <span className="text-green-500">
              <Icon icon="ph:check-circle-fill" />
            </span>
          )}
        </div>
      </div>
      {/* error and success message*/}
      {error && (
        <div className="mt-2 text-red-600 block text-sm">{error.message}</div>
      )}
      {/* validated and success message*/}
      {validate && (
        <div className="mt-2 text-green-600 block text-sm">{validate}</div>
      )}
      {/* only description */}
      {description && <span className="input-help">{description}</span>}
    </div>
  );
};

export default Textarea;
