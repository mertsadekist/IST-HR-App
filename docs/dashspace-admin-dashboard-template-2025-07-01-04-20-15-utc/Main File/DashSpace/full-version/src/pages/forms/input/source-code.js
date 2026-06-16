export const basicInput = `
import Textinput from "@/components/ui/Textinput";
const BasicInput = () => {
    return (
        <Textinput placeholder="Username" id="bs_01" type="text" />
    );
};
export default BasicInput;
`

export const inputWithLabel = `
import Textinput from "@/components/ui/Textinput";
const InputWithLabel = () => {
    return (
        <Textinput
            label="Username"
            id="bs1"
            type="text"
            placeholder="Username"
        />
    );
};
export default InputWithLabel;
`
export const inputWithHelperText = `
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
`

export const roundedInput = `
import Textinput from "@/components/ui/Textinput";
const RoundedInput = () => {
    return (
        <Textinput
            type="text"
            placeholder="Username"
            className="rounded-[999px] px-4"
        />
    );
};
export default RoundedInput;
`

export const inputWithSize = `
import Textinput from "@/components/ui/Textinput";
const InputWithSize = () => {
    return (
        <div className="space-y-5">
        <Textinput
          type="text"
          className="h-[32px] text-sm"
          placeholder="Username"
        />
        <Textinput id="bs_s" type="text" placeholder="Username" />
        <Textinput type="text" className="h-[52px]" placeholder="Username" />
      </div>
    );
};
export default InputWithSize;
`

export const disabledTextInput = `
import React from 'react';
import Textinput from "@/components/ui/Textinput";
const DisabledTextInput = () => {
    return (
        <Textinput disabled type="text" placeholder="Username" />
    );
};
export default DisabledTextInput;
`

export const readOnlyTextInput = `
import Textinput from "@/components/ui/Textinput";
const ReadOnlyTextInput = () => {
    return (
        <Textinput readonly type="text" placeholder="Username" />
    );
};
export default ReadOnlyTextInput;
`

export const inputValidation = `
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
`