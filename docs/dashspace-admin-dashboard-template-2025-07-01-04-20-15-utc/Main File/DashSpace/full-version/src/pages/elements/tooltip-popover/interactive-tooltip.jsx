import React from 'react';
import Tooltip from "@/components/ui/Tooltip";
const InteractiveTooltip = () => {
    return (
        <div className="space-xy flex flex-wrap">
            <Tooltip
                title="Interactive"
                content="Interactive tooltip"
                placement="top"
                arrow
                interactive
                className="btn btn-outline-primary"
                theme="primary"
            />
        </div>
    );
};

export default InteractiveTooltip;