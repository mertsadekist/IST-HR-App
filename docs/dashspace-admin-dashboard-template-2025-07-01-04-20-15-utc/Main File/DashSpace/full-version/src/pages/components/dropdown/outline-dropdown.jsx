import React from 'react';
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
const OutlineDropdown = () => {
    return (
        <div className="space-xy">
          <Dropdown
            classMenuItems="left-0  w-[180px] top-[110%] "
            label={
              <Button
                text="primary"
                className="btn-outline-primary"
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
                className="btn-outline-secondary"
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
                className="btn-outline-success"
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
                className="btn-outline-info"
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
                className="btn-outline-warning"
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
                className="btn-outline-danger"
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
                className="btn-outline-dark"
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
                className="btn-outline-light"
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

export default OutlineDropdown;