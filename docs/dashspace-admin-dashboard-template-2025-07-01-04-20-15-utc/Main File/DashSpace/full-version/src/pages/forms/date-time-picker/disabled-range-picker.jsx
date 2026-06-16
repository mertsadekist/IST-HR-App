import React, { useState } from 'react';
import Flatpickr from "react-flatpickr";

const DisabledRangePicker = () => {
    const [picker4, setPicker4] = useState(new Date());
    return (
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
    );
};

export default DisabledRangePicker;