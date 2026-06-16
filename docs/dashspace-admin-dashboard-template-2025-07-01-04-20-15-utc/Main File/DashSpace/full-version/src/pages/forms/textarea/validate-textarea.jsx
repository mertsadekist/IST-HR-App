import React from 'react';
import Textarea from "@/components/ui/Textarea";
const ValidateTextarea = () => {
    const errorMessage = {
        message: "This is invalid",
    };
    return (
        <div className=" space-y-3">
            <Textarea
                id="ValidState"
                placeholder="Type here.."
                validate="This is valid ."
            />
            <Textarea
                id="InvalidState"
                placeholder="Type here.."
                error={errorMessage}
            />
        </div>
    );
};

export default ValidateTextarea;