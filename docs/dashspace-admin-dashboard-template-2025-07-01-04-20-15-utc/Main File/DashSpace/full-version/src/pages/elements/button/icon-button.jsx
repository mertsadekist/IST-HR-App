import React from "react";
import Button from "@/components/ui/Button";
const IconButton = () => {
    return (
        <div className="space-xy flex items-center">
            <Button icon="ph:heart" className="btn-primary h-9 w-9 rounded-full p-0" />
            <Button icon="ph:pentagram" className="btn-secondary h-9 w-9 rounded-full p-0" />
            <Button icon="ph:cloud-arrow-down" className="btn-info h-9 w-9 p-0 " />
            <Button icon="ph:trend-up" className="btn-warning h-9 w-9  p-0" />
            <Button icon="ph:trash" className="btn-danger h-9 w-9  p-0" />
        </div>
    );
};

export default IconButton;
