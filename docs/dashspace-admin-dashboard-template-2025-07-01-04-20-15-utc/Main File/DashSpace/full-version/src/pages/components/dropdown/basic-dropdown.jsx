import React from 'react';
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
const BasicDropdown = () => {
    return (
        <div className="space-xy">
            <Dropdown
                classMenuItems="left-0  w-[180px] top-[110%] "
                label={
                    <Button
                        text="primary"
                        className="btn-primary"
                        icon="ph:caret-down"
                        iconPosition="right"
                        div
                        iconClass="text-lg"
                    />
                }
            ></Dropdown>
            <Dropdown
                classMenuItems="left-0  w-[180px] top-[110%] "
                label={
                    <Button
                        text="secondary"
                        className="btn-secondary"
                        icon="ph:caret-down"
                        iconPosition="right"
                        div
                        iconClass="text-lg"
                    />
                }
            ></Dropdown>
            <Dropdown
                classMenuItems="left-0  w-[180px] top-[110%] "
                label={
                    <Button
                        text="success"
                        className="btn-success"
                        icon="ph:caret-down"
                        iconPosition="right"
                        div
                        iconClass="text-lg"
                    />
                }
            ></Dropdown>
            <Dropdown
                classMenuItems="left-0  w-[180px] top-[110%] "
                label={
                    <Button
                        text="info"
                        className="btn-info"
                        icon="ph:caret-down"
                        iconPosition="right"
                        div
                        iconClass="text-lg"
                    />
                }
            ></Dropdown>
            <Dropdown
                classMenuItems="left-0  w-[180px] top-[110%] "
                label={
                    <Button
                        text="warning"
                        className="btn-warning"
                        icon="ph:caret-down"
                        iconPosition="right"
                        div
                        iconClass="text-lg"
                    />
                }
            ></Dropdown>
            <Dropdown
                classMenuItems="left-0  w-[180px] top-[110%] "
                label={
                    <Button
                        text="danger"
                        className="btn-danger"
                        icon="ph:caret-down"
                        iconPosition="right"
                        div
                        iconClass="text-lg"
                    />
                }
            ></Dropdown>
            <Dropdown
                classMenuItems="left-0  w-[180px] top-[110%] "
                label={
                    <Button
                        text="Dark"
                        className="btn-dark"
                        icon="ph:caret-down"
                        iconPosition="right"
                        div
                        iconClass="text-lg"
                    />
                }
            ></Dropdown>
            <Dropdown
                classMenuItems="left-0  w-[180px] top-[110%] "
                label={
                    <Button
                        text="Light"
                        className="btn-light"
                        icon="ph:caret-down"
                        iconPosition="right"
                        div
                        iconClass="text-lg"
                    />
                }
            ></Dropdown>
        </div>
    );
};

export default BasicDropdown;