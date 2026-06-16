import React from 'react';
import SplitDropdown from "@/components/ui/Split-dropdown";
const SplitDropdowns = () => {
    return (
        <div className="space-xy">
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="primary"
                labelClass="btn-primary"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="secondary"
                labelClass="btn-secondary"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="success"
                labelClass="btn-success"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="info"
                labelClass="btn-info"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="warning"
                labelClass="btn-warning"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="danger"
                labelClass="btn-danger"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="Light"
                labelClass="btn-light"
            />
        </div>
    );
};

export default SplitDropdowns;