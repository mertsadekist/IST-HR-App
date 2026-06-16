import React from 'react';
import Tooltip from "@/components/ui/Tooltip";
const BasicTooltip = () => {
    return (
        <div className="space-xy flex flex-wrap">
            <Tooltip
                title="primary"
                content="primary style"
                placement="top"
                className="btn btn-primary "
                arrow
                theme="primary"
            />
            <Tooltip
                title="secondary"
                content="secondary style"
                placement="top"
                className="btn btn-secondary "
                arrow
                theme="secondary"
            />
            <Tooltip
                title="success"
                content="success style"
                placement="top"
                className="btn btn-success"
                arrow
                theme="success"
            />
            <Tooltip
                title="info"
                content="info style"
                placement="top"
                className="btn btn-info "
                arrow
                theme="info"
            />
            <Tooltip
                title="warning"
                content="warning style"
                placement="top"
                className="btn btn-warning "
                arrow
                theme="warning"
            />
            <Tooltip
                title="danger"
                content="danger style"
                placement="top"
                className="btn btn-danger "
                arrow
                theme="danger"
            />
            <Tooltip
                title="dark"
                content="Dark style"
                placement="top"
                className="btn btn-dark "
                arrow
                theme="dark"
            />
            <Tooltip
                title="light"
                content="Light style"
                placement="top"
                className="btn btn-light "
                arrow
                theme="light"
            />
        </div>
    );
};

export default BasicTooltip;