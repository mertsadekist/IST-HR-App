import React from 'react';
import Select from "@/components/ui/Select";
const MultipleSelect = () => {
    const options = [
        {
          value: "option1",
          label: "Option 1",
        },
        {
          value: "option2",
          label: "Option 2",
        },
        {
          value: "option3",
          label: "Option 3",
        },
      ];
    return (
        <>
            <Select options={options} size={5} multiple />
        </>
    );
};

export default MultipleSelect;