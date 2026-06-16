import React from 'react';
import Button from "@/components/ui/Button";
const RoundedButton = () => {
    return (
        <div className="space-xy">
            <Button text="primary" className="btn-primary rounded-[999px] " />
            <Button text="secondary" className="btn-secondary rounded-[999px]" />
            <Button text="success" className="btn-success rounded-[999px]" />
            <Button text="info" className="btn-info rounded-[999px]" />
            <Button text="warning" className="btn-warning rounded-[999px]" />
            <Button text="error" className="btn-danger rounded-[999px]" />
            <Button text="Dark" className="btn-dark rounded-[999px]" />
            <Button text="Light" className="btn-light rounded-[999px]" />
        </div>
    );
};

export default RoundedButton;