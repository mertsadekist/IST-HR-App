import React from "react";
import Card from "@/components/ui/code-snippet";
import FormRepeater from "./form-repeater";
import { formRepeater } from "./source-code";

const FormRepeaterPage = () => {


  return (
    <div>
      <Card title="form repeating" code={formRepeater}>
        <FormRepeater />
      </Card>
    </div>
  );
};

export default FormRepeaterPage;
