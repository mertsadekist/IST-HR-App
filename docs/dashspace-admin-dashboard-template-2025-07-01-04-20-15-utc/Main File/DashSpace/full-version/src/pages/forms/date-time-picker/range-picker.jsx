import React, { useState } from 'react';
import Flatpickr from "react-flatpickr";
const RangePicker = () => {
    const [picker3, setPicker3] = useState();
    return (
        <Flatpickr
            value={picker3}
            id="range-picker"
            className="text-control py-2"
            placeholder="Choose Date.."
            onChange={(date) => setPicker3(date)}
            options={{
                mode: "range",
                defaultDate: ["2020-02-01", "2020-02-15"],
            }}
        />
    );
};

export default RangePicker;

