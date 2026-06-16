export const basicDropdown = `
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
const BasicDropdown = () => {
  return (
    <>
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
    />
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
            />}
      >
      </Dropdown>
    </>
  )
}
export default BasicDropdown
`;

export const outlineDropdown = `
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
const OutlineDropdown = () => {

  return (
    <>
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
      
    </>
  )
}
export default OutlineDropdown
`;

export const splitDropdowns = `
import SplitDropdown from "@/components/ui/Split-dropdown";
const SplitDropdowns = () => {

  return (
    <>
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
      
    </>
  )
}
export default SplitDropdowns
`;

export const splitOutlineDropdown = `
import SplitDropdown from "@/components/ui/Split-dropdown";
const SplitOutlineDropdown = () => {

  return (
    <>
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
    </>
  )
}
export default SplitOutlineDropdown
`;
