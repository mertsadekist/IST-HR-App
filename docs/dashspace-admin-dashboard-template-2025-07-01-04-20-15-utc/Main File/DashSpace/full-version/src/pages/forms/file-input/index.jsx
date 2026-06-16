import React from "react";
import Card from "@/components/ui/code-snippet";

import DropZone from "./DropZone";
import BasicInputFile from "./basic-input-file";
import {
  basicInputFile,
  basicInputPreview,
  dropZone,
  multipleFilePreview,
  multipleSelectFile,
} from "./source-code";
import MultipleSelect from "./multiple-select";
import BasicInputPreview from "./basic-input-preview";
import MultipleFilePreview from "./multiple-file-preview";

const FileinputPage = () => {
  return (
    <div className=" space-y-5">
      <Card title="Basic Input File" code={basicInputFile}>
        <BasicInputFile />
      </Card>
      <Card title="Multiple Select" code={multipleSelectFile}>
        <MultipleSelect />
      </Card>
      <Card title="Basic input with preview" code={basicInputPreview}>
        <BasicInputPreview />
      </Card>
      <Card title="multiple file with preview" code={multipleFilePreview}>
        <MultipleFilePreview />
      </Card>
      <div className="xl:col-span-2 col-span-1">
        <Card title="File upload" code={dropZone}>
          <DropZone />
        </Card>
      </div>
    </div>
  );
};

export default FileinputPage;
