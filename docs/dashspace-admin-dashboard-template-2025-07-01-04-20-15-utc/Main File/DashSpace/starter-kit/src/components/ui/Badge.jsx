import React from "react";
import Icon from "@/components/ui/Icon";

const Badge = ({
  className = "bg-red-600 text-white",
  label,
  icon,
  children,
}) => {
  return (
    <span className={`badge ${className}`}>
      {!children && (
        <span className="inline-flex items-center">
          {icon && (
            <span className="inline-block text-base ltr:mr-2 rtl:ml-2">
              <Icon icon={icon} />
            </span>
          )}
          {label}
        </span>
      )}
      {children && <span className="inline-flex items-center">{children}</span>}
    </span>
  );
};

export default Badge;
