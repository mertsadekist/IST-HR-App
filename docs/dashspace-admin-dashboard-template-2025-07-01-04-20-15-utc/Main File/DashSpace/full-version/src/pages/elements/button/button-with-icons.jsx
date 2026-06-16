import React from "react";
import Button from "@/components/ui/Button";
const ButtonWithIcon = () => {
    return (
        <div className="space-xy flex items-center">

            <Button icon="ph:heart" text="Love" className="btn-primary" />
            <Button icon="ph:pentagram" text="Right Icon" className="btn-secondary" />
            <Button icon="ph:cloud-arrow-down" text="download" className="btn-info" iconPosition="right" />
            <Button icon="ph:trend-up" text="Right Icon" className="btn-warning" iconPosition="right" />
            <Button icon="ph:trash" className="btn-danger" text="Delate" iconPosition="right" />

        </div>
    );
};

export default ButtonWithIcon;
