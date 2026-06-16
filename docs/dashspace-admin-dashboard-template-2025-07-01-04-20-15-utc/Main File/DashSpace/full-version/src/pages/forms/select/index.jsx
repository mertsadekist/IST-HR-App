import Card from "@/components/ui/code-snippet";
import BasicSelect from "./basic-select";
import { basicSelect, disabledSelect, multipleSelect, roundedSelect, sizeSelect } from "./source-code";
import SizeSelect from "./size-select";
import MultipleSelect from "./multiple-select";
import RoundedSelect from "./rounded-select";
import DisabledSelect from "./disabled-select";

const SelectPage = () => {

  return (
    <div className=" space-y-5">
      <Card title="Basic Select" code={basicSelect}>
        <BasicSelect />
      </Card>
      <Card title="Size Select" code={sizeSelect}>
        <SizeSelect />
      </Card>
      <Card title="Multipie Select" code={multipleSelect}>
        <MultipleSelect />
      </Card>
      <Card title="Rounded  Select" code={roundedSelect}>
        <RoundedSelect />
      </Card>
      <Card title="disabled  Select" code={disabledSelect}>
        <DisabledSelect />
      </Card>
    </div>
  );
};

export default SelectPage;
