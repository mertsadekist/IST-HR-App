import React from 'react';
import Textinput from "@/components/ui/Textinput";
const InputWithHelperText = () => {
    return (
        <Textinput
        type="text"
        placeholder="Username"
        description="This is Description"
      />
    );
};

export default InputWithHelperText;