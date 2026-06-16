import React from 'react';
import InputGroup from "@/components/ui/InputGroup";
const MergedAddon = () => {
    return (
        <div className=" space-y-4">
            <InputGroup
                type="text"
                label="Prepend Addon"
                placeholder="Username"
                prepend="@"
                merged
            />
            <InputGroup
                type="text"
                placeholder="Username"
                label="Append Addon"
                append="@facebook.com"
                merged
            />
            <InputGroup
                type="text"
                placeholder="Username"
                label="Between input:"
                prepend="$"
                append="120"
                merged
            />
        </div>
    );
};

export default MergedAddon;