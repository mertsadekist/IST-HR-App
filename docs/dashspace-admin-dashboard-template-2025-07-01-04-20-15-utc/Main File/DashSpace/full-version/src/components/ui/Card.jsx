import React from "react";

const Card = ({
  children,
  title,
  subtitle,
  headerslot,
  className = "custom-class",
  bodyClass = "px-5 py-4",
  noborder,
  titleClass = "custom-class",
  headerClass = "custom-header-class",
}) => {
  return (
    <div
      className={`card
    ${className}
        `}
    >
      {(title || subtitle) && (
        <header
          className={`card-header ${
            noborder ? "no-border" : ""
          } ${headerClass}`}
        >
          <div>
            {title && <div className={`card-title ${titleClass}`}>{title}</div>}
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {headerslot && <div className="card-header-slot">{headerslot}</div>}
        </header>
      )}
      <main className={`card-body ${bodyClass}`}>{children}</main>
    </div>
  );
};

export default Card;
