import React, { useState } from "react";
import Icon from "@/components/ui/Icon";

const Alert = ({
  children,
  className = "alert-primary",
  icon,
  toggle,
  dismissible,
  label,
}) => {
  const [isShow, setIsShow] = useState(true);

  const handleDestroy = () => {
    setIsShow(false);
  };

  return (
    <>
      {isShow ? (
        <div
          className={`alert  flex   items-center space-x-3 rtl:space-x-reverse ${className}`}
        >
          {icon && (
            <div className={`grow-0 text-xl`}>
              <Icon icon={icon} />
            </div>
          )}
          <div className="grow">{children ? children : label}</div>
          {dismissible && (
            <div
              className="flex-none text-xl cursor-pointer"
              onClick={handleDestroy}
            >
              <Icon icon="ph:x" />
            </div>
          )}
          {toggle && (
            <div className="grow-0 text-xl cursor-pointer" onClick={toggle}>
              <Icon icon="ph:x" />
            </div>
          )}
        </div>
      ) : null}
    </>
  );
};

export default Alert;
