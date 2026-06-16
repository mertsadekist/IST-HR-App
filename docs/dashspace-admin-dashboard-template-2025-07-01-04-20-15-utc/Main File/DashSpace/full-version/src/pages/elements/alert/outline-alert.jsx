import React from 'react';
import Alert from "@/components/ui/Alert";
const OutlineAlert = () => {
    return (
        <div className=" space-y-4">
            <Alert label="This is simple alert" className="alert-outline-primary" />
            <Alert label="This is simple alert" className="alert-outline-secondary" />
            <Alert label="This is simple alert" className="alert-outline-success" />
            <Alert label="This is simple alert" className="alert-outline-danger" />
            <Alert label="This is simple alert" className="alert-outline-warning" />
            <Alert label="This is simple alert" className="alert-outline-info" />
            <Alert label="This is simple alert" className="alert-outline-light" />
            <Alert label="This is simple alert" className="alert-outline-dark" />
        </div>
    );
};

export default OutlineAlert;