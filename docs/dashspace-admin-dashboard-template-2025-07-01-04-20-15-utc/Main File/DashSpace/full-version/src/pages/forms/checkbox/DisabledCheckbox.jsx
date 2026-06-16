import React, { useState } from "react";
import Checkbox from "@/components/ui/Checkbox";
const DisabledCheckbox = () => {
  const [checked, setChecked] = useState(false);
  const [checked2, setChecked2] = useState(true);
  return (
    <div className="flex flex-wrap space-xy-6">
      <Checkbox
        label="UnChecked disabled"
        disabled
        value={checked}
        onChange={() => setChecked(!checked)}
      />
      <Checkbox
        label="Checked disabled"
        disabled
        value={checked2}
        onChange={() => setChecked2(!checked2)}
        activeClass="border-indigo-500 bg-indigo-500"
      />
    </div>
  );
};

export default DisabledCheckbox;
