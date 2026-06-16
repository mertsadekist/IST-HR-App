import React, { useState } from 'react';
import Flatpickr from "react-flatpickr";
const DateTime = () => {
    const [picker2, setPicker2] = useState();
    return (
        <Flatpickr
        value={picker2}
        data-enable-time
        id="date-time-picker"
        placeholder="Choose Date & Time.."
        className="text-control py-2"
        onChange={(date) => setPicker2(date)}
      />
    );
};

export default DateTime;