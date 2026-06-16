import React from "react";

const Avatar = ({
  src,
  className = "h-8 w-8",
  alt = "image-title",
  imageClass = "rounded-full",
  dot,
  dotClass = " bg-indigo-500",
}) => {
  return (
    <div className={` inline-flex shrink-0 relative ${className}  `}>
      <img
        src={src}
        alt={alt}
        className={`w-full h-full block object-cover object-center relative ring-2 ring-white ${imageClass}  `}
      />
      {dot && (
        <div
          className={` 
        absolute right-0 top-0 h-2.5 w-2.5 rounded-full border border-white
         dark:border-indigo-200  ${dotClass}`}
        ></div>
      )}
    </div>
  );
};

export default Avatar;
