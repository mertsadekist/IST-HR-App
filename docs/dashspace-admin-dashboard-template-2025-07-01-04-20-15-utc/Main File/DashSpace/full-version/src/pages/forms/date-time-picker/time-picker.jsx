import React, { useState } from 'react';
import Flatpickr from "react-flatpickr";
const TimePicker = () => {
    const [basic, setBasic] = useState(new Date());
    return (
        <Flatpickr
            className="text-control py-2"
            value={basic}
            placeholder="Choose Time.."
            options={{
                enableTime: true,
                noCalendar: true,
                dateFormat: "H:i",
                time_24hr: true,
            }}
            onChange={(date) => setBasic(date)}
        />
    );
};

export default TimePicker;