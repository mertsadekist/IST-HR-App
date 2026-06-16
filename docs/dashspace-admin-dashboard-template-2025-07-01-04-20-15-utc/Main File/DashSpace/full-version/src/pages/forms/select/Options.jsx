import React, { useState } from "react";
import Select, { components } from "react-select";
import makeAnimated from "react-select/animated";
import Card from "@/components/ui/code-snippet";

const fruits = [
  { value: "banana", label: "Banana" },
  { value: "watermelon", label: "Watermelon" },
  { value: "kiwi", label: "Kiwi" },
  { value: "grapefruit", label: "Grapefruit" },
  { value: "pear", label: "Pear" },
];
const formatGroupLabel = (data) => (
  <div className="flex justify-between items-center">
    <strong>
      <span className=" text-2xl font-semibold capitalize">{data.label}</span>
    </strong>
    <span>{data.options.length}</span>
  </div>
);
const groupedOptions = [
  {
    label: "Fruits",
    options: [
      { value: "banana", label: "Banana" },
      { value: "apple", label: "Apple" },
      { value: "orange", label: "Orange" },
      { value: "mango", label: "Mango" },
      { value: "grapes", label: "Grapes" },
    ],
  },
  {
    label: "Vegetables",
    options: [
      { value: "carrot", label: "Carrot" },
      { value: "broccoli", label: "Broccoli" },
      { value: "cucumber", label: "Cucumber" },
      { value: "spinach", label: "Spinach" },
      { value: "sweet potato", label: "Sweet Potato" },
    ],
  },
];

const animatedComponents = makeAnimated();

// Fixed Options Select

const styles = {
  multiValue: (base, state) => {
    return state.data.isFixed ? { ...base, opacity: "0.5" } : base;
  },
  multiValueLabel: (base, state) => {
    return state.data.isFixed
      ? { ...base, color: "#626262", paddingRight: 6 }
      : base;
  },
  multiValueRemove: (base, state) => {
    return state.data.isFixed ? { ...base, display: "none" } : base;
  },
  option: (provided, state) => ({
    ...provided,
    fontSize: "14px",
  }),
};
const orderOptions = (values) => {
  if (values.length > 0)
    return values
      .filter((v) => v.isFixed)
      .concat(values.filter((v) => !v.isFixed));
};

// start component
const OptionsSelect = () => {
  const [fixedValue, setFixedValue] = useState(
    orderOptions([fruits[0], fruits[1]])
  );
  const fixedOnChange = (value, { action, removedValue }) => {
    switch (action) {
      case "remove-value":
      case "pop-value":
        if (removedValue.isFixed) {
          return;
        }
        break;
      case "clear":
        value = fruits.filter((v) => v.isFixed);
        break;
      default:
        break;
    }

    value = orderOptions(value);
    setFixedValue(value);
  };

  return (
    <div className=" space-y-5">
      <Card title=" Multi Select..">
        <Select
          isClearable={false}
          defaultValue={[fruits[2], fruits[3]]}
          styles={styles}
          isMulti
          name="colors"
          options={fruits}
          className="react-select"
          classNamePrefix="select"
          id="mul_1"
        />
      </Card>
      <Card title="Grouped Select">
        <Select
          isClearable={false}
          defaultValue={fruits[1]}
          options={groupedOptions}
          styles={styles}
          formatGroupLabel={formatGroupLabel}
          className="react-select"
          classNamePrefix="select"
          id="mul_2"
        />
      </Card>

      <Card title="Animated Select">
        <Select
          isClearable={false}
          closeMenuOnSelect={false}
          components={animatedComponents}
          defaultValue={[fruits[4], fruits[5]]}
          isMulti
          options={fruits}
          styles={styles}
          className="react-select"
          classNamePrefix="select"
          id="animated_1"
        />
      </Card>

      <Card title="Fixed Options Select">
        <Select
          isClearable={false}
          value={fixedValue}
          styles={styles}
          isMulti
          onChange={fixedOnChange}
          name="furits"
          className="react-select"
          classNamePrefix="select"
          options={fruits}
          id="dis_s"
        />
      </Card>
    </div>
  );
};

export default OptionsSelect;
