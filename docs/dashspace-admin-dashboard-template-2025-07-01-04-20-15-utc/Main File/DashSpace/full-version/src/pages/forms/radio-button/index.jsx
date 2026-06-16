import React, { useState } from "react";
import Card from "@/components/ui/code-snippet";
import Radio from "@/components/ui/Radio";
import BasicRadio from "./basic-radio";
import { basicRadio, outlineRadio } from "./source-code";
import OutlineRadio from "./outline-radio";
const RadioPage = () => {

  const [selectOption, setSelectOption] = useState("Orange");


  const handleColor = (e) => {
    setSelectColor(e.target.value);
  };
  const handleColor2 = (e) => {
    setSelectColor2(e.target.value);
  };
  const handleOption = (e) => {
    setSelectOption(e.target.value);
  };
  const options = [
    {
      value: "Orange",
      label: "Orange",
    },
    {
      value: "Apple",
      label: "Apple",
    },
    {
      value: "Banana",
      label: "Banana",
    },
  ];


 

  return (
    <div className="space-y-5 ">
      <Card title="Basic Radio" code={basicRadio}>
        <BasicRadio />
      </Card>
      <Card title="Outline Radio" code={outlineRadio}>
        <OutlineRadio />
      </Card>
      <Card title="disabled Radio ">
     
      </Card>

      <Card title="Radio Model">
        <div className="flex flex-wrap space-xy">
          {options.map((option, i) => (
            <Radio
              key={`${i}-lst`}
              label={option.label}
              name="option"
              value={option.value}
              checked={selectOption === option.value}
              onChange={handleOption}
            />
          ))}
        </div>
        {selectOption && (
          <div className="mt-3">
            <span className="text-sm text-gray-400 ">Selected Option: </span>
            <span className="text-sm text-gray-700 dark:text-gray-100">
              {selectOption}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
};

export default RadioPage;
