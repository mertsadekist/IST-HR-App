import React from "react";
import Card from "@/components/ui/code-snippet";
import BasicDropdown from "./basic-dropdown";
import { basicDropdown, outlineDropdown, splitDropdowns, splitOutlineDropdown } from "./source-code";
import OutlineDropdown from "./outline-dropdown";
import SplitDropdowns from "./split-dropdowns";
import SplitOutlineDropdown from "./split-outline-dropdown";

const DropdownPage = () => {
  return (
    <div className=" space-y-5">
      <Card title="Basic dropdowns" code={basicDropdown}>
        <BasicDropdown />
      </Card>
      <Card title="Outline Dropdowns" code={outlineDropdown}>
        <OutlineDropdown />
      </Card>
      <Card title="Split Dropdowns" code={splitDropdowns}>
        <SplitDropdowns />
      </Card>
      <Card title=" Split Outline Dropdowns" code={splitOutlineDropdown}>
       <SplitOutlineDropdown/>
      </Card>
    </div>
  );
};

export default DropdownPage;
