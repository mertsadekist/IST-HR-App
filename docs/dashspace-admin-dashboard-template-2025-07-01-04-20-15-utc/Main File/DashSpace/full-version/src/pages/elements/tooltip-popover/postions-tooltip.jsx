import React from 'react';
import Tooltip from "@/components/ui/Tooltip";
const PositionsTooltip = () => {
    return (
        <div className="space-xy flex flex-wrap ">
        <Tooltip
            title="top"
            content="Top"
            placement="top"
            className="btn btn-primary light"
            theme="primary"
            arrow
        />
        <Tooltip
            title="Top Start"
            content="Top Start"
            placement="top-start"
            arrow
            className="btn btn-secondary light"
            theme="secondary"
        />
        <Tooltip
            title="Top End"
            content="Top End"
            placement="top-end"
            arrow
            className="btn btn-success light"
            theme="success"
        />
        <Tooltip
            title="Right"
            content="Right"
            placement="right"
            arrow
            className="btn btn-info light"
            theme="info"
        />
        <Tooltip
            title="Right Start"
            content="Right Start"
            placement="right-start"
            arrow
            className="btn btn-warning light"
            theme="warning"
        />
        <Tooltip
            title="Right End"
            content="Right End"
            placement="right-end"
            arrow
            className="btn btn-danger light"
            theme="danger"
        />
        <Tooltip
            title="Left"
            content="Left"
            placement="left"
            arrow
            className="btn btn-primary light"
            theme="primary"
        />
        <Tooltip
            title="Left Start"
            content="Left Start"
            placement="left-start"
            arrow
            className="btn btn-secondary light"
            theme="secondary"
        />
        <Tooltip
            title="Left End"
            content="Left End"
            placement="left-end"
            arrow
            className="btn btn-success light"
            theme="success"
        />
        <Tooltip
            title="Bottom"
            content="Bottom"
            placement="bottom"
            arrow
            className="btn btn-info light"
            theme="info"
        />
        <Tooltip
            title="Bottom Start"
            content="Bottom Start"
            placement="bottom-start"
            arrow
            className="btn btn-warning light"
            theme="warning"
        />
        <Tooltip
            title="Bottom End"
            content="Bottom End"
            placement="bottom-end"
            arrow
            className="btn btn-danger light"
            theme="danger"
        />
    </div>
    );
};

export default PositionsTooltip;