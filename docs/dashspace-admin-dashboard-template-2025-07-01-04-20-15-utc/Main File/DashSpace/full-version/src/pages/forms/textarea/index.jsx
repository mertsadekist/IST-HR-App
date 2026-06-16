import React, { useState } from "react";
import Card from "@/components/ui/code-snippet";
import BasicTextarea from "./basic-textarea";
import { basicTextarea, displayRows, validateTextarea } from "./source-code";
import DisplayRows from "./display-rows";
import ValidateTextarea from "./validate-textarea";

const Textareapage = () => {

  const [value, setValue] = useState("");

  const handleFormatter = (e) => {
    const value = e.target.value;
    setValue(value);
  };
  return (
    <div className=" space-y-5 ">
      <Card title="Basic Textarea" code={basicTextarea}>
        <BasicTextarea />
      </Card>
      <Card title="Displayed Rows" code={displayRows}>
        <DisplayRows />
      </Card>

      <Card title="Textarea validation" code={validateTextarea}>
        <ValidateTextarea />
      </Card>
    </div>
  );
};

export default Textareapage;
