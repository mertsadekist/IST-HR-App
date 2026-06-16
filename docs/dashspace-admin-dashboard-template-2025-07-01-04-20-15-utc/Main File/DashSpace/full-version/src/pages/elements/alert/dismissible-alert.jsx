import React from 'react';
import Alert from "@/components/ui/Alert";
const DismissibleAlert = () => {
    return (
        <div className="space-y-4">
            <Alert dismissible icon="ph:info" label="This is simple alert"></Alert>
            <Alert dismissible icon="ph:info" className="alert-outline-secondary !text-fuchsia-500" label="This is simple alert"></Alert>
            <Alert dismissible icon="ph:shield-check" className="alert-success light" >This is simple alert </Alert>
            <Alert dismissible icon="ph:warning-diamond" className="alert-danger">This is simple alert </Alert>
            <Alert dismissible icon="ph:seal-warning" className="alert-warning">This is simple alert</Alert>
            <Alert dismissible icon="ph:infinity" className="alert-info"> This is simple alert </Alert>
        </div>
    );
};

export default DismissibleAlert;