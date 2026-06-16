import React, { useState } from "react";
import Checkbox from "@/components/ui/Checkbox";
const BasicCheckbox = () => {
  const [checked, setChecked] = useState(true);
  const [checked6, setChecked6] = useState(false);
  const [checked7, setChecked7] = useState(false);
  const [checked8, setChecked8] = useState(false);
  const [checked9, setChecked9] = useState(false);
  const [checked10, setChecked10] = useState(false);
  return (
    <div className="flex flex-wrap space-xy-6">
      <Checkbox
        label="Default & Primary"
        value={checked}
        onChange={() => setChecked(!checked)}
      />

      <Checkbox
        label="Secondary"
        value={checked6}
        activeClass="border-fuchsia-500 bg-fuchsia-500"
        className=" group-hover:border-fuchsia-500"
        onChange={() => setChecked6(!checked6)}
      />
      <Checkbox
        label="Success"
        value={checked7}
        activeClass="border-green-500 bg-green-500"
        className=" group-hover:border-green-500"
        onChange={() => setChecked7(!checked7)}
      />
      <Checkbox
        label="Danger"
        value={checked8}
        activeClass="border-red-500 bg-red-500"
        className=" group-hover:border-red-500"
        onChange={() => setChecked8(!checked8)}
      />
      <Checkbox
        label="Warning"
        value={checked9}
        activeClass="border-yellow-500 bg-yellow-500"
        className=" group-hover:border-yellow-500"
        onChange={() => setChecked9(!checked9)}
      />
      <Checkbox
        label="Info"
        value={checked10}
        activeClass="border-cyan-500 bg-cyan-500"
        className=" group-hover:border-cyan-500"
        onChange={() => setChecked10(!checked10)}
      />
    </div>
  );
};

export default BasicCheckbox;
