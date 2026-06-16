import React from "react";
import Button from "@/components/ui/Button";
const ButtonDisabled = () => {
    return (
        <div className="space-xy">
            <Button text="primary" className="btn-primary " disabled />
            <Button text="secondary" className=" btn-secondary" disabled />
            <Button text="success" className=" btn-success" disabled />
            <Button text="info" className=" btn-info" disabled />
            <Button text="warning" className=" btn-warning" disabled />
            <Button text="error" className=" btn-danger" disabled />
            <Button text="Dark" className=" btn-dark" disabled />
            <Button text="Light" className=" btn-light" disabled />
        </div>
    );
};

export default ButtonDisabled;
