import React from 'react';
import SplitDropdown from "@/components/ui/Split-dropdown";
const SplitOutlineDropdown = () => {
    return (
        <div className="space-xy">
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="primary"
                labelClass="btn-outline-primary"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="secondary"
                labelClass="btn-outline-secondary"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="success"
                labelClass="btn-outline-success"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="info"
                labelClass="btn-outline-info"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="warning"
                labelClass="btn-outline-warning"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="danger"
                labelClass="btn-outline-danger"
            />
            <SplitDropdown
                classMenuItems="left-0  w-[180px] top-[110%]"
                label="Light"
                labelClass="btn-outline-light"
            />
        </div>
    );
};

export default SplitOutlineDropdown;