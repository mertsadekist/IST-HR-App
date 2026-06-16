import React from 'react';
import InputGroup from "@/components/ui/InputGroup";
const BasicInputGroup = () => {
    return (
        <div className=" space-y-4">
            <InputGroup
                type="text"
                label="Prepend Addon"
                placeholder="Username"
                prepend="@"
            />
            <InputGroup
                type="text"
                placeholder="Username"
                label="Append Addon"
                append="@facebook.com"
            />
            <InputGroup
                type="text"
                placeholder="Username"
                label="Between input:"
                prepend="$"
                append="120"
            />
        </div>
    );
};

export default BasicInputGroup;