import React from "react";
import Icon from "@/components/ui/Icon";
const MenuItem = ({ activeSubmenu, i, item, toggleSubmenu }) => {
  return (
    <div
      className={`menu-link ${
        activeSubmenu === i ? "parent_active not-collapsed" : "collapsed"
      }`}
      onClick={() => toggleSubmenu(i)}
    >
      <div className="flex-1 flex items-start">
        <span className="menu-icon">
          <Icon icon={item.icon} />
        </span>
        <div className="text-box">{item.title}</div>
      </div>
      <div className="flex-0">
        <div
          className={`menu-arrow transform transition-all duration-300 ${
            activeSubmenu === i ? " rotate-90" : ""
          }`}
        >
          <Icon icon="ph:caret-right" />
        </div>
      </div>
    </div>
  );
};

export default MenuItem;
