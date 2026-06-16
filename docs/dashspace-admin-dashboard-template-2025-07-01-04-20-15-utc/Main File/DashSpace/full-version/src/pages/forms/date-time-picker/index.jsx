import Card from "@/components/ui/code-snippet";
import BasicDatePicker from "./basic-date-picker";
import { basicDatePicker, dateRangePicker, dateTimePicker, disbledRangePicker, rangePicker, timePicker } from "./source-code";
import DateTime from "./date-time";
import RangePicker from "./range-picker";
import DisabledRangePicker from "./disabled-range-picker";
import TimePicker from "./time-picker";
import DateRangePicker from "./date-range-picker";

const FlatpickerPage = () => {

  return (
    <div className=" space-y-5">
      <Card title="Basic Date Picker" code={basicDatePicker}>
        <BasicDatePicker />
      </Card>
      <Card title="Date & Time" code={dateTimePicker}>
        <DateTime />
      </Card>
      <Card title="range picker" code={rangePicker}>
        <RangePicker />
      </Card>
      <Card title="Disabled Range" code={disbledRangePicker}>
        <DisabledRangePicker />
      </Card>
      <Card title="Time picker" code={timePicker}>
        <TimePicker />
      </Card>
      <Card title="Date Range Picker" code={dateRangePicker}>
        <DateRangePicker />
      </Card>
    </div>
  );
};

export default FlatpickerPage;
