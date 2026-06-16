import React from "react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/dist/tippy.css";
import "tippy.js/themes/light.css";
import "tippy.js/themes/light-border.css";
import "tippy.js/animations/shift-away.css";
import "tippy.js/animations/scale-subtle.css";
import "tippy.js/animations/perspective-extreme.css";
import "tippy.js/animations/perspective-subtle.css";
import "tippy.js/animations/perspective.css";
import "tippy.js/animations/scale-extreme.css";
import "tippy.js/animations/scale-subtle.css";
import "tippy.js/animations/scale.css";
import "tippy.js/animations/shift-away-extreme.css";
import "tippy.js/animations/shift-away-subtle.css";
import "tippy.js/animations/shift-away.css";
import "tippy.js/animations/shift-toward-extreme.css";
import "tippy.js/animations/shift-toward-subtle.css";
import "tippy.js/animations/shift-toward.css";
import Icon from "@/components/ui/Icon";

const Tooltip = ({
  children,
  content = "content",
  title,
  className = "btn btn-dark",
  placement = "top",
  arrow = true,
  theme = "dark",
  animation = "shift-away",
  trigger = "mouseenter focus",
  interactive = false,
  allowHTML = false,
  maxWidth = 300,
  duration = 200,
  hasicon,
}) => {
  return (
    <div className="custom-tippy">
      {!hasicon ? (
        <Tippy
          content={content}
          placement={placement}
          arrow={arrow}
          theme={theme}
          animation={animation}
          trigger={trigger}
          interactive={interactive}
          allowHTML={allowHTML}
          maxWidth={maxWidth}
          duration={duration}
        >
          {children ? children : <div className={className}>{title}</div>}
        </Tippy>
      ) : (
        <div className="flex items-center space-x-1  rtl:space-x-reverse">
          <span className={className}>{title}</span>
          <Tippy
            content={content}
            placement={placement}
            arrow={arrow}
            theme={theme}
            animation={animation}
            trigger={trigger}
            interactive={interactive}
            allowHTML={allowHTML}
            maxWidth={maxWidth}
            duration={duration}
          >
            <span className=" text-xl inline-block ">
              <Icon icon="heroicons:information-circle" />
            </span>
          </Tippy>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
