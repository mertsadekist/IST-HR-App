import React from 'react';
import Tooltip from "@/components/ui/Tooltip";
const TriggerTooltip = () => {
    return (
        <div className="space-xy flex flex-wrap">
            <Tooltip
                title="Mouseenter"
                content="Mouseenter"
                placement="top"
                arrow
                trigger="mouseenter"
                className="btn btn-outline-primary"
                theme="primary"
            />
            <Tooltip
                title="Click"
                content="Click"
                placement="top"
                arrow
                trigger="click"
                className="btn btn-outline-secondary"
                theme="secondary"
            />
        </div>
    );
};

export default TriggerTooltip;