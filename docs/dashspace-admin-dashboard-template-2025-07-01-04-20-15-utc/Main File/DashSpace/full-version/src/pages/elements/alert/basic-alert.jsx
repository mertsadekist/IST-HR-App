import React from 'react';
import Alert from "@/components/ui/Alert";
const BasicAlert = () => {
    return (
        <div className="space-y-4">
            <Alert label="This is simple alert" className="alert-primary" />
            <Alert label="This is simple alert" className="alert-secondary" />
            <Alert label="This is simple alert" className="alert-success" />
            <Alert label="This is simple alert" className="alert-danger" />
            <Alert label="This is simple alert" className="alert-warning" />
            <Alert label="This is simple alert" className="alert-info" />
            <Alert label="This is simple alert" className="alert-light" />
            <Alert label="This is simple alert" className="alert-dark" />
        </div>
    );
};

export default BasicAlert;