import React from "react";
import Button from "@/components/ui/Button";
const OutlinedButton = () => {
    return (
        <div className="space-xy">
            <Button text="primary" className="btn-outline-primary" />
            <Button text="secondary" className="btn-outline-secondary" />
            <Button text="success" className="btn-outline-success" />
            <Button text="info" className="btn-outline-info" />
            <Button text="warning" className="btn-outline-warning" />
            <Button text="error" className="btn-outline-danger" />
            <Button text="dark" className="btn-outline-dark" />
            <Button text="light" className="btn-outline-light" />
        </div>
    );
};

export default OutlinedButton;
