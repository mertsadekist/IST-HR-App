import React from "react";
import Button from "@/components/ui/Button";
const ButtonSizes = () => {
    return (
        <div className="space-xy">
            <Button text="Button" className="btn-primary px-3 h-6 text-xs " />
            <Button text="Button" className="btn-primary h-8 px-4 text-[13px]" />
            <Button text="Button" className="btn-primary " />
            <Button text="Button" className="btn-primary  h-11  text-base" />
            <Button text="Button" className="btn-primary  h-12  text-base" />
        </div>
    );
};

export default ButtonSizes;
