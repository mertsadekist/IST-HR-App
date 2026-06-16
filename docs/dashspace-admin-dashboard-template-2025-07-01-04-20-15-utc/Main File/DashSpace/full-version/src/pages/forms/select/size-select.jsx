import React, { useState } from 'react';
import Select from "@/components/ui/Select";

const SizeSelect = () => {
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
    const [value2, setValue2] = useState("");
    const handleChange2 = (e) => {
        setValue2(e.target.value);
    };
    return (
        <div className="space-y-3">
            <Select
                options={options}
                onChange={handleChange2}
                value={value2}
                size={5}
            />
            <div className="text-base">
                <span className="text-gray-500 dark:text-gray-300 inline-block mr-3">
                    Selected value:
                </span>
                <span className="text-gray-900 dark:text-gray-300 font-medium">
                    {value2}
                </span>
            </div>
        </div>
    );
};

export default SizeSelect;