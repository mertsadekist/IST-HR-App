export const basicDatePicker = `
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
`

export const dateTimePicker = `
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
`

export const rangePicker = `
import React, { useState } from 'react';
import Flatpickr from "react-flatpickr";
const RangePicker = () => {
    const [picker3, setPicker3] = useState();
    return (
        <>
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
        <>
    );
};

export default RangePicker;
`

export const disbledRangePicker = `
import React, { useState } from 'react';
import Flatpickr from "react-flatpickr";

const DisabledRangePicker = () => {
    const [picker4, setPicker4] = useState(new Date());
    return (
        <>
        <Flatpickr
        value={picker4}
        id="disabled-picker"
        className="text-control py-2"
        placeholder="Choose Date.."
        onChange={(date) => setPicker4(date)}
        options={{
          dateFormat: "Y-m-d",
          disable: [
            {
              from: new Date(),
              // eslint-disable-next-line no-mixed-operators
              to: new Date(new Date().getTime() + 120 * 60 * 60 * 1000),
            },
          ],
        }}
      />
      <>
    );
};

export default DisabledRangePicker;
`

export const timePicker = `
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
`

export const dateRangePicker = `
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
`