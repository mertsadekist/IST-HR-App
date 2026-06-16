import React from 'react';
import Textinput from "@/components/ui/Textinput";
const InputValidation = () => {
    const errorMessage = {
        message: "Username invalid state",
    };
    return (
        <div className="space-y-5">
            <Textinput
                type="text"
                placeholder="Username"
                validate="Username is valid state."
            />
            <Textinput type="text" placeholder="Username" error={errorMessage} />
        </div>
    );
};

export default InputValidation;