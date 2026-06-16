import React from 'react';
import Alert from "@/components/ui/Alert";
const SoftAlert = () => {
    return (
        <div className=" space-y-4">
            <Alert label="This is simple alert" className="alert-primary light" />
            <Alert label="This is simple alert" className="alert-secondary light" />
            <Alert label="This is simple alert" className="alert-success light" />
            <Alert label="This is simple alert" className="alert-danger light" />
            <Alert label="This is simple alert" className="alert-warning light" />
            <Alert label="This is simple alert" className="alert-info light" />
            <Alert label="This is simple alert" className="alert-light light" />
        </div>
    );
};

export default SoftAlert;