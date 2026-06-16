import React, { useState } from "react";
import Radio from "@/components/ui/Radio";
const BasicRadio = () => {
  const [selectColor, setSelectColor] = useState("blue-500");
  const colors = [
    {
      value: "blue-500",
      label: "Default & Primary",
      activeClass: "ring-offset-indigo-500 border-indigo-500",
      className: "group-hover:border-indigo-500",
    },
    {
      value: "gray-500",
      label: "Secondary",
      activeClass: "ring-offset-fuchsia-500 border-fuchsia-500",
      className: " group-hover:border-fuchsia-500",
    },
    {
      value: "green-500",
      label: "Success",
      activeClass: "ring-offset-green-500 border-green-500",
      className: " group-hover:border-green-500",
    },
    {
      value: "red-500",
      label: "Danger",
      activeClass: "ring-offset-red-500 border-red-500",
      className: " group-hover:border-red-500",
    },
    {
      value: "yellow-500",
      label: "Warning",
      activeClass: "ring-offset-yellow-500 border-yellow-500",
      className: " group-hover:border-yellow-500",
    },
    {
      value: "cyan-500",
      label: "Info",
      activeClass: "ring-offset-cyan-500 border-cyan-500",
      className: " group-hover:border-cyan-500",
    },
  ];
  const handleColor = (e) => {
    setSelectColor(e.target.value);
  };
  return (
    <div className="flex flex-wrap space-xy">
      {colors.map((color, i) => (
        <Radio
          key={`${i}-fst`}
          label={color.label}
          name="color"
          value={color.value}
          checked={selectColor === color.value}
          onChange={handleColor}
          activeClass={color.activeClass}
          className={color.className}
        />
      ))}
    </div>
  );
};

export default BasicRadio;
