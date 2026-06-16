import React, { useState } from 'react';
import Checkbox from "@/components/ui/Checkbox";
const CheckboxModal = () => {
    const [selected, setSelected] = useState([]);
    const options = [
      {
        value: "Apple",
        label: "apple",
      },
      {
        value: "PineApple",
        label: "pineapple",
      },
      {
        value: "Strawberry",
        label: "strawberry",
      },
    ];
    return (
        <>
            <div className="flex flex-wrap space-xy-6  items-center">
                {options.map((option, i) => (
                    <Checkbox
                        key={i}
                        name="jorina"
                        label={option.label}
                        value={selected.includes(option.value)}
                        onChange={() => {
                            if (selected.includes(option.value)) {
                                setSelected(selected.filter((item) => item !== option.value));
                            } else {
                                setSelected([...selected, option.value]);
                            }
                        }}
                    />
                ))}
            </div>
            {
                selected.length > 0 && (
                    <div className="text-gray-900 dark:text-white mt-6 ">
                        Selected: [{selected.join(", ")}]
                    </div>
                )
            }
        </>
    );
};

export default CheckboxModal;