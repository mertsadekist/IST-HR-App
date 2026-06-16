import React, { useState } from 'react';
import Button from "@/components/ui/Button";
import Fileinput from "@/components/ui/Fileinput";
const BasicInputPreview = () => {
    const [selectedFile2, setSelectedFile2] = useState(null);
    const handleFileChange2 = (e) => {
        setSelectedFile2(e.target.files[0]);
    };

    return (
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
    );
};

export default BasicInputPreview;