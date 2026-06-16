import React, { useState } from 'react';
import Flatpickr from "react-flatpickr";
const BasicDatePicker = () => {
    const [picker, setPicker] = useState();
    return (
        <Flatpickr
            className="text-control py-2"
            value={picker}
            placeholder="Choose Date.."
            onChange={(date) => setPicker(date)}
            id="default-picker"
        />
    );
};

export default BasicDatePicker;