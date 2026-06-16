import React, { useState } from "react";
import Fileinput from "@/components/ui/Fileinput";
import Button from "@/components/ui/Button";
const BasicInputFile = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };
  return (
    <div className="flex space-x-3">
      <Fileinput selectedFile={selectedFile} onChange={handleFileChange}>
        <Button
          div
          icon="ph:upload"
          text="Choose File"
          iconClass="text-2xl"
          className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300  text-gray-600 btn-sm"
        />
      </Fileinput>

      <Fileinput selectedFile={selectedFile} onChange={handleFileChange}>
        <Button
          div
          icon="ph:upload"
          text="Choose File"
          iconClass="text-2xl"
          className="bg-indigo-500  text-white btn-sm"
        />
      </Fileinput>
      <Fileinput selectedFile={selectedFile} onChange={handleFileChange}>
        <Button
          div
          icon="ph:upload"
          text="Choose File"
          iconClass="text-2xl"
          className="btn-outline-primary btn-sm"
        />
      </Fileinput>
      <Fileinput selectedFile={selectedFile} onChange={handleFileChange}>
        <Button
          icon="ph:upload"
          className="btn-info h-10 w-10  rounded-full items-center justify-center p-0"
        />
      </Fileinput>
    </div>
  );
};

export default BasicInputFile;
