import React from 'react';
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