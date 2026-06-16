import React from "react";
import Card from "@/components/ui/code-snippet";
import BasicInput from "./basic-input";
import { basicInput, disabledTextInput, inputValidation, inputWithHelperText, inputWithLabel, inputWithSize, readOnlyTextInput, roundedInput } from "./source-code";
import InputWithLabel from "./input-with-label";
import InputWithHelperText from "./input-with-helper-text";
import RoundedInput from "./rounded-input";
import InputWithSize from "./input-with-size";
import DisabledTextInput from "./disabled-text-input";
import ReadOnlyTextInput from "./read-only-textinput";
import InputValidation from "./input-validation";

const InputPage = () => {


  return (
    <div className=" space-y-5">
      <Card title="Basic Input Text" code={basicInput}>
        <BasicInput />
      </Card>
      <Card title="Label Text" code={inputWithLabel}>
        <InputWithLabel />
      </Card>
      <Card title="Helper Text" code={inputWithHelperText}>
        <InputWithHelperText />
      </Card>
      <Card title="Rounded Input" code={roundedInput}>
        <RoundedInput />
      </Card>

      <Card title="Input Size" code={inputWithSize}>
        <InputWithSize />
      </Card>

      <Card title="Disabled Text Input" code={disabledTextInput}>
        <DisabledTextInput />
      </Card>

      <Card title="Readonly Text Input" code={readOnlyTextInput}>
        <ReadOnlyTextInput />
      </Card>

      <Card title="Input Validation" code={inputValidation}>
        <InputValidation />
      </Card>

    </div>
  );
};

export default InputPage;
