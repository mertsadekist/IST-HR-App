import React, { useState } from "react";
import Card from "@/components/ui/code-snippet";
import ReactSelect from "./ReactSelect";
import OptionsSelect from "./Options";

const ReactSelectPage = () => {
  return (
    <div className=" space-y-5">
      <ReactSelect />
      <OptionsSelect />
    </div>
  );
};

export default ReactSelectPage;
