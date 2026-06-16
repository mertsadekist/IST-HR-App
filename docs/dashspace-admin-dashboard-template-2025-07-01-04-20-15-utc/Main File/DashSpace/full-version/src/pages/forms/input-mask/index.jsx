import React from "react";
import Card from "@/components/ui/code-snippet";
import InputMask from "./input-mask";
import { inputMask } from "./source-code";


const InputMaskPage = () => {
    return (
        <div>
            <Card title="Input Mask" code={inputMask}>
                <InputMask />
            </Card>
        </div>
    );
};

export default InputMaskPage;
