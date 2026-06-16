import React from 'react';
import Card from "@/components/ui/code-snippet";
import BasicAlert from './basic-alert';
import { basicAlert, dismissibleAlert, outlineAlert, softAlert } from "./source-code"
import SoftAlert from './soft-alert';
import OutlineAlert from './outline-alert';
import DismissibleAlert from './dismissible-alert';
const AlertPage = () => {
    return (
        <div className="grid xl:grid-cols-2 grid-cols-1 gap-5">
            <Card title="Basic Alert" code={basicAlert}>
                <BasicAlert />
            </Card>
            <Card title="Outline Alerts" code={outlineAlert}>
                <OutlineAlert />
            </Card>
            <Card title="Soft Alerts" code={softAlert}>
                <SoftAlert />
            </Card>
            <Card title="Dismissible Alerts" code={dismissibleAlert}>
                <DismissibleAlert />
            </Card>
        </div>
    );
};

export default AlertPage;