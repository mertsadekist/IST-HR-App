import React from "react";
import Button from "@/components/ui/Button";
const ButtonLoading = () => {
    return (
        <div className="space-xy">
            <Button text="primary" className="btn-primary " isLoading />
            <Button text="secondary" className=" btn-secondary" isLoading />
            <Button text="success" className=" btn-success" isLoading />
            <Button text="info" className=" btn-info" isLoading />
            <Button text="warning" className=" btn-warning" isLoading />
            <Button text="error" className=" btn-danger" isLoading />
            <Button text="Dark" className=" btn-dark" isLoading />
            <Button text="Light" className=" btn-light" isLoading />
        </div>
    );
};

export default ButtonLoading;
