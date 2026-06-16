import React from "react";
import Card from "@/components/ui/code-snippet";
import BasicSpinner from "./basic-spinner";
import { basicSpinner, pingSpinner, softColorSpinner } from "./source-code";
import SoftColorSpinner from "./soft-color-spinner";
import PingSpinner from "./ping-spinner";

const SpinerPage = () => {
    return (
        <div className="space-y-5">
            <Card title="Basic Spinner" code={basicSpinner}>
                <BasicSpinner />
            </Card>
            <Card title="Soft Color Spinner" code={softColorSpinner}>
                <SoftColorSpinner />
            </Card>
            <Card title="Ping" code={pingSpinner}>
                <PingSpinner />
            </Card>
        </div>
    );
};

export default SpinerPage;
