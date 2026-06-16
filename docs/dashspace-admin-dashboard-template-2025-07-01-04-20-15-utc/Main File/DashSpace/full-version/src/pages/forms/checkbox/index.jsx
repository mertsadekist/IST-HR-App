import Card from "@/components/ui/code-snippet";
import BasicCheckbox from "./Basic";
import CircleCheckbox from "./Circle";
import OutlineCheckbox from "./Outline";
import { basicCheckbox, checkboxModal, circleCheckbox, disabledCheckbox, outlineCheckbox } from "./source-card";
import DisabledCheckbox from "./DisabledCheckbox";
import CheckboxModal from "./checkboxModal";

const CheckboxPage = () => {

  return (
    <div className=" space-y-5">
      
      <Card title="Basic Checkbox" code={basicCheckbox}>
        <BasicCheckbox />
      </Card>

      <Card title="Circle Checkbox" code={circleCheckbox}>
        <CircleCheckbox />
      </Card>

      <Card title="Outline Checkbox" code={outlineCheckbox}>
        <OutlineCheckbox />
      </Card>

      <Card title="Disabled Checkbox" code={disabledCheckbox}>
        <DisabledCheckbox />
      </Card>

      <Card title="Checkbox Model" code={checkboxModal}>
        <CheckboxModal />
      </Card>
    </div>
  );
};

export default CheckboxPage;
