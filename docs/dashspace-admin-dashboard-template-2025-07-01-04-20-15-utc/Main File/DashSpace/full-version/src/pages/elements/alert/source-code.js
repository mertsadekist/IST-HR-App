export const basicAlert = `
import Alert from "@/components/ui/Alert"
const BasicAlert = () => {
  return (
    <>
    <Alert label="This is simple alert" className="alert-primary" />
    <Alert label="This is simple alert" className="alert-secondary" />
    <Alert label="This is simple alert" className="alert-success" />
    <Alert label="This is simple alert" className="alert-danger" />
    <Alert label="This is simple alert" className="alert-warning" />
    <Alert label="This is simple alert" className="alert-info" />
    <Alert label="This is simple alert" className="alert-light" />
    <Alert label="This is simple alert" className="alert-dark" />
    </>
  )
}
export default BasicAlert
`;

export const outlineAlert = `
import Alert from "@/components/ui/Alert"
const OutlineAlerts = () => {
  return (
    <>
    <Alert label="This is simple alert" className="alert-outline-primary" />
    <Alert label="This is simple alert" className="alert-outline-secondary" />
    <Alert label="This is simple alert" className="alert-outline-success" />
    <Alert label="This is simple alert" className="alert-outline-danger" />
    <Alert label="This is simple alert" className="alert-outline-warning" />
    <Alert label="This is simple alert" className="alert-outline-info" />
    <Alert label="This is simple alert" className="alert-outline-light" />
    <Alert label="This is simple alert" className="alert-outline-dark" />
    </>
  )
}
export default OutlineAlerts
`;
export const softAlert = `
import Alert from "@/components/ui/Alert"
const SoftAlerts = () => {
  return (
    <>
    <Alert label="This is simple alert" className="alert-primary light" />
    <Alert label="This is simple alert" className="alert-secondary light" />
    <Alert label="This is simple alert" className="alert-success light" />
    <Alert label="This is simple alert" className="alert-danger light" />
    <Alert label="This is simple alert" className="alert-warning light" />
    <Alert label="This is simple alert" className="alert-info light" />
    <Alert label="This is simple alert" className="alert-light light" />
    </>
  )
}
export default SoftAlerts
`;

export const dismissibleAlert = `
import Alert from "@/components/ui/Alert"
const DismissibleAlert = () => {
  return (
    <>
    <Alert dismissible icon="ph:info" label="This is simple alert"></Alert>
    <Alert dismissible icon="ph:info" className="alert-outline-secondary !text-fuchsia-500" label="This is simple alert"></Alert>
    <Alert dismissible icon="ph:shield-check" className="alert-success light" >This is simple alert </Alert>
    <Alert dismissible icon="ph:warning-diamond" className="alert-danger">This is simple alert </Alert>
    <Alert dismissible icon="ph:seal-warning" className="alert-warning">This is simple alert</Alert>
    <Alert dismissible icon="ph:infinity" className="alert-info"> This is simple alert </Alert>
    </>
  )
}
export default DismissibleAlert
`;
