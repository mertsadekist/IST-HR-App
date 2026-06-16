import React, { useState } from "react";
import Radio from "@/components/ui/Radio";
const OutlineRadio = () => {
  const [selectColor2, setSelectColor2] = useState("blue-500");
  const handleColor2 = (e) => {
    setSelectColor2(e.target.value);
  };
  const colors2 = [
    {
      value: "blue-500",
      label: "Primary",
      activeClass:
        "ring-offset-0 border-indigo-500 ring-[5px]  !bg-indigo-500   dark:ring-offset-gray-800 dark:ring-offset-[5px]",
      className: " group-hover:border-indigo-500",
    },
    {
      value: "gray-500",
      label: "Secondary",
      activeClass:
        "ring-offset-0 border-fuchsia-500 ring-[5px]  !bg-fuchsia-500   dark:ring-offset-gray-800 dark:ring-offset-[5px]",
      className: " group-hover:border-fuchsia-500",
    },
    {
      value: "green-500",
      label: "Success",
      activeClass:
        "ring-offset-0 border-green-500 ring-[5px]  !bg-green-500   dark:ring-offset-gray-800 dark:ring-offset-[5px]",
      className: " group-hover:border-green-500",
    },
    {
      value: "red-500",
      label: "Danger",
      activeClass:
        "ring-offset-0 border-red-500 ring-[5px]  !bg-red-500   dark:ring-offset-gray-800 dark:ring-offset-[5px]",
      className: " group-hover:border-red-500",
    },
    {
      value: "yellow-500",
      label: "Warning",
      activeClass:
        "ring-offset-0 border-yellow-500 ring-[5px]  !bg-yellow-500   dark:ring-offset-gray-800 dark:ring-offset-[5px]",
      className: " group-hover:border-yellow-500",
    },
    {
      value: "cyan-500",
      label: "Info",
      activeClass:
        "ring-offset-0 border-cyan-500 ring-[5px]  !bg-cyan-500   dark:ring-offset-gray-800 dark:ring-offset-[5px]",
      className: " group-hover:border-cyan-500",
    },
  ];
  return (
    <div className="flex flex-wrap space-xy">
      {colors2.map((color, i) => (
        <Radio
          key={`${i}-mst`}
          label={color.label}
          name="color"
          value={color.value}
          checked={selectColor2 === color.value}
          onChange={handleColor2}
          activeClass={color.activeClass}
          className={color.className}
        />
      ))}
    </div>
  );
};

export default OutlineRadio;
