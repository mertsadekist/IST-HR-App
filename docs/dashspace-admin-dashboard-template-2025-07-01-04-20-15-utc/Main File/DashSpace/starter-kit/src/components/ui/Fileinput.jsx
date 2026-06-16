import React from "react";

const Fileinput = ({
  label,
  onChange,
  placeholder = "Choose a file or drop it here...",
  multiple,
  preview,
  className,
  id,
  selectedFile,
  badge,
  selectedFiles,
  children,
}) => {
  return (
    <div>
      <div className="file-group">
        <label className={className}>
          <input
            type="file"
            onChange={onChange}
            className=" w-full hidden"
            id={id}
            multiple={multiple}
            placeholder={placeholder}
          />
          {label ? label : children}
        </label>

        {!multiple && preview && selectedFile && (
          <div className="w-[200px] h-[200px] mx-auto mt-6  ">
            <img
              src={selectedFile ? URL.createObjectURL(selectedFile) : ""}
              className="w-full  h-full block rounded object-contain border p-2  border-gray-200"
              alt={selectedFile?.name}
            />
          </div>
        )}
        {multiple && preview && selectedFiles.length > 0 && (
          <div className="flex flex-wrap space-x-5 rtl:space-x-reverse">
            {selectedFiles.map((file, index) => (
              <div
                className="xl:w-1/5 md:w-1/3 w-1/2 rounded mt-6 border p-2  border-gray-200"
                key={index}
              >
                <img
                  src={file ? URL.createObjectURL(file) : ""}
                  className="object-cover w-full h-full rounded"
                  alt={file?.name}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Fileinput;
