import React from "react";
import Select from "react-select";
import Card from "@/components/ui/code-snippet";

const furits = [
  { value: "caramel", label: "Caramel" },
  { value: "red velvet", label: "Red Velvet" },
  { value: "matcha", label: "Matcha" },
];

const styles = {
  option: (provided, state) => ({
    ...provided,
    fontSize: "14px",
  }),
};
const ReactSelect = () => {
  return (
    <div className=" space-y-5">
      <Card title=" Basic">
        <Select
          className="react-select"
          classNamePrefix="select"
          defaultValue={furits[0]}
          options={furits}
          styles={styles}
          id="hh"
        />
      </Card>
      <Card title=" Clearable">
        <Select
          className="react-select"
          classNamePrefix="select"
          defaultValue={furits[1]}
          styles={styles}
          name="clear"
          options={furits}
          isClearable
          id="hh2"
        />
      </Card>
      <Card title=" Loading">
        <Select
          className="react-select"
          classNamePrefix="select"
          defaultValue={furits[2]}
          name="loading"
          options={furits}
          isLoading={true}
          isClearable={false}
          id="hh23"
          styles={styles}
        />
      </Card>
      <Card title=" Disabled">
        <Select
          className="react-select"
          classNamePrefix="select"
          defaultValue={furits[3]}
          name="disabled"
          options={furits}
          isDisabled={true}
          isClearable={false}
          id={"dis"}
          styles={styles}
        />
      </Card>
    </div>
  );
};

export default ReactSelect;
