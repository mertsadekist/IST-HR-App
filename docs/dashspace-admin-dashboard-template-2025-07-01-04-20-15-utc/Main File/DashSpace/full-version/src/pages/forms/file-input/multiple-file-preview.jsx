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
    );
};

export default MultipleFilePreview;
