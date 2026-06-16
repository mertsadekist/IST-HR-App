import React from 'react';
import Tooltip from "@/components/ui/Tooltip";
const AnimatedTooltip = () => {
    return (
        <div className="space-xy flex flex-wrap">
            <Tooltip
                title="Shift-away"
                content="Shift-away"
                placement="top"
                arrow
                animation="shift-away"
                className="btn btn-outline-primary"
                theme="primary"
            />
            <Tooltip
                title="Shift-toward"
                content="Shift-toward"
                placement="top"
                arrow
                animation="shift-toward"
                className="btn btn-outline-secondary"
                theme="secondary"
            />
            <Tooltip
                title="Scale"
                content="Scale"
                placement="top"
                arrow
                animation="scale"
                className="btn btn-outline-success"
                theme="success"
            />
            <Tooltip
                title="Fade"
                content="Fade"
                placement="top"
                arrow
                animation="fade"
                className="btn btn-outline-info"
                theme="info"
            />
            <Tooltip
                title="Perspective"
                content="Perspective"
                placement="top"
                arrow
                animation="Perspective"
                className="btn btn-outline-warning"
                theme="warning"
            />
        </div>
    );
};

export default AnimatedTooltip;