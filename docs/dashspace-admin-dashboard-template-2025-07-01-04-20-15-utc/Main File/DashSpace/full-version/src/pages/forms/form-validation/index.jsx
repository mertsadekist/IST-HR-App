import React from "react";
import Card from "@/components/ui/code-snippet";
import ValidationTypes from "./validation-types";
import { formValidation } from "./source-code";

const FormValidation = () => {
  return (
    <Card title="Validation Types" code={formValidation}>
      <ValidationTypes />
    </Card>
  );
};

export default FormValidation;
