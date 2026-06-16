import React, { useState } from 'react';
import Radio from "@/components/ui/Radio";
const DisabeldRadio = () => {
    const [value, setValue] = useState("C");
    const handleChange = (e) => {
        setValue(e.target.value);
      };
    return (
        <div className="flex flex-wrap space-xy">
        <Radio
          label="Default disabled"
          name="x2"
          disabled
          value="D"
          checked={value === "D"}
          onChange={handleChange}
        />
        <Radio
          label="Checked  disabled"
          disabled
          name="x2"
          value="C"
          checked={value === "C"}
          onChange={handleChange}
        />
      </div>
    );
};

export default DisabeldRadio;