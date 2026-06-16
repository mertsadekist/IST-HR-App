export const basicInputFile = `
import React, { useState } from 'react';
import Fileinput from "@/components/ui/Fileinput";
import Button from "@/components/ui/Button";
const BasicInputFile = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
    };
  return (
    <>
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
    </>
  )
}
export default BasicInputFile
`;

export const multipleSelectFile = `
import Fileinput from "@/components/ui/Fileinput";
import Button from "@/components/ui/Button";
const MultipleSelectFiles = () => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const handleFileChangeMultiple = (e) => {
        const files = e.target.files;
        const filesArray = Array.from(files).map((file) => file);
        setSelectedFiles(filesArray);
    };
  return (
    <>
    <Fileinput
       multiple
       selectedFiles={selectedFiles}
       onChange={handleFileChangeMultiple}>
    <Button
        div
        icon="ph:upload"
        text="Choose File"
        iconClass="text-2xl"
        className="bg-gray-100  text-gray-600 dark:bg-gray-700 dark:text-gray-300 btn-sm"/>
    </Fileinput>
    </>
  )
}
export default MultipleSelectFiles
`;

export const basicInputPreview = `
import React, { useState } from 'react';
import Button from "@/components/ui/Button";
import Fileinput from "@/components/ui/Fileinput";
const BasicInputPreview = () => {
    const [selectedFile2, setSelectedFile2] = useState(null);
    const handleFileChange2 = (e) => {
        setSelectedFile2(e.target.files[0]);
    };
  return (
    <>
    <Fileinput
    name="basic"
    selectedFile={selectedFile2}
    onChange={handleFileChange2}
    preview
>
    <Button
        div
        icon="ph:upload"
        text="Choose File"
        iconClass="text-2xl"
        className="bg-gray-100  dark:bg-gray-700 dark:text-gray-300 text-gray-600 btn-sm"
    />
</Fileinput>
    </>
  )
}
export default BasicInputPreview
`;

export const multipleFilePreview = `
import React, { useState } from 'react';
import Fileinput from "@/components/ui/Fileinput";
import Button from "@/components/ui/Button";
const MultipleFilePreview = () => {
    const [selectedFiles2, setSelectedFiles2] = useState([]);
    const handleFileChangeMultiple2 = (e) => {
        const files = e.target.files;
        const filesArray = Array.from(files).map((file) => file);
        setSelectedFiles2(filesArray);
    };
  return (
    <>
    <Fileinput
    selectedFiles={selectedFiles2}
    onChange={handleFileChangeMultiple2}
    multiple
    preview
>
    <Button
        div
        icon="ph:upload"
        text="Choose File"
        iconClass="text-2xl"
        className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-gray-600 btn-sm"
    />
</Fileinput>
    </>
  )
}
export default MultipleFilePreview
`;

export const dropZone = `
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import uploadSvgImage from "@/assets/images/svg/upload.svg";
const DropZone = () => {
  const [files, setFiles] = useState([]);
  const { getRootProps, getInputProps, isDragAccept } = useDropzone({
    accept: {
      "image/*": [],
    },
    onDrop: (acceptedFiles) => {
      setFiles(
        acceptedFiles.map((file) =>
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        )
      );
    },
  });
  return (
    <div>
      <div className="w-full text-center border-dashed border border-gray-400 rounded-lg py-[52px] flex flex-col justify-center items-center">
        {files.length === 0 && (
          <div {...getRootProps({ className: "dropzone" })}>
            <input className="hidden" {...getInputProps()} />
            <img src={uploadSvgImage} alt="" className="mx-auto mb-4" />
            {isDragAccept ? (
              <p className="text-sm text-gray-500 dark:text-gray-300 ">
                Drop the files here ...
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-300 f">
                Drop files here or click to upload.
              </p>
            )}
          </div>
        )}
        <div className="flex space-x-4">
          {files.map((file, i) => (
            <div key={i} className="mb-4 flex-none">
              <div className="h-[300px] w-[300px] mx-auto mt-6 rounded-lg">
                <img
                  src={file.preview}
                  className=" object-contain h-full w-full block rounded-lg"
                  onLoad={() => {
                    URL.revokeObjectURL(file.preview);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default DropZone;
`;
