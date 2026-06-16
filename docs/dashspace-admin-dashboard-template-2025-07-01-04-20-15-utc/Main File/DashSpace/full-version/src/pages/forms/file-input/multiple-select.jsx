import React, { useState } from 'react';
import Fileinput from "@/components/ui/Fileinput";
import Button from "@/components/ui/Button";
const MultipleSelect = () => {
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
                onChange={handleFileChangeMultiple}
            >
                <Button
                    div
                    icon="ph:upload"
                    text="Choose File"
                    iconClass="text-2xl"
                    className="bg-gray-100  text-gray-600 dark:bg-gray-700 dark:text-gray-300 btn-sm"
                />
            </Fileinput>
        </>
    );
};

export default MultipleSelect;