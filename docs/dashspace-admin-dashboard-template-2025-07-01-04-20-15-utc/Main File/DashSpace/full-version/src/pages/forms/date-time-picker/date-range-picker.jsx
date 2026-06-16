import React, { useState } from 'react';
import Flatpickr from "react-flatpickr";
const DateRangePicker = () => {
    const [picker, setPicker] = useState();
    return (
        <Flatpickr
            value={picker}
            id="multi-dates-picker"
            className="text-control py-2"
            placeholder="Choose Date.."
            options={{ mode: "multiple" }}
            onChange={(date) => setPicker(date)}
        />
    );
};

export default DateRangePicker;