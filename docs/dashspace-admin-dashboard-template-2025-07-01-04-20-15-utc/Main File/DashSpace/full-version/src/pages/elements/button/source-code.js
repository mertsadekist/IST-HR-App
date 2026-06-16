export const basicButton = `
import Button from "@/components/ui/Button'
const BasicButton = () => {
  return (
    <>
      <Button text="primary" className="btn-primary " />
      <Button text="secondary" className="btn-secondary" />
      <Button text="success" className="btn-success" />
      <Button text="info" className="btn-info" />
      <Button text="warning" className="btn-warning" />
      <Button text="error" className="btn-danger" />
      <Button text="Dark" className="btn-dark" />
      <Button text="Light" className="btn-light" />
    </>
  )
}
export default BasicButton
`;

export const roundedButton = `
import Button from "@/components/ui/Button'
const RoundedButton = () => {
  return (
      <>
        <Button text="primary" className="btn-primary rounded-[999px] " />
        <Button text="secondary" className="btn-secondary rounded-[999px]" />
        <Button text="success" className="btn-success rounded-[999px]" />
        <Button text="info" className="btn-info rounded-[999px]" />
        <Button text="warning" className="btn-warning rounded-[999px]" />
        <Button text="error" className="btn-danger rounded-[999px]" />
        <Button text="Dark" className="btn-dark rounded-[999px]" />
        <Button text="Light" className="btn-light rounded-[999px]" />
      </>
  );
};

export default RoundedButton;
`;

export const outlinedButton = `
import Button from "@/components/ui/Button'
const OutlinedButton = () => {
  return (
      <>
       <Button text="primary" className="btn-outline-primary" />
       <Button text="secondary" className="btn-outline-secondary" />
       <Button text="success" className="btn-outline-success" />
       <Button text="info" className="btn-outline-info" />
       <Button text="warning" className="btn-outline-warning" />
       <Button text="error" className="btn-outline-danger" />
       <Button text="dark" className="btn-outline-dark" />
       <Button text="light" className="btn-outline-light" />
      </>
  );
};

export default OutlinedButton;
`;

export const softColorButton = `
import Button from "@/components/ui/Button'
const SoftColorButton = () => {
  return (
    <>
       <Button text="primary" className="btn-primary " />
       <Button text="secondary" className="btn-secondary" />
       <Button text="success" className="btn-success" />
       <Button text="info" className="btn-info" />
       <Button text="warning" className="btn-warning" />
       <Button text="error" className="btn-danger" />
       <Button text="Dark" className="btn-dark" />
       <Button text="Light" className="btn-light" />
    </>
  );
};
export default SoftColorButton;
`;

export const glowButton = `
import Button from "@/components/ui/Button'
const GlowButton = () => {
  return (
  <>
    <Button text="primary" className="btn-primary hover:shadow-lg hover:shadow-indigo-500/50" />
    <Button text="secondary" className=" btn-secondary hover:shadow-lg hover:shadow-fuchsia-500/50" />
    <Button text="success" className=" btn-success hover:shadow-lg hover:shadow-green-500/50" />
    <Button text="info" className=" btn-info hover:shadow-lg hover:shadow-cyan-500/50" />
    <Button text="warning" className=" btn-warning hover:shadow-lg hover:shadow-yellow-500/50" />
    <Button text="error" className=" btn-danger hover:shadow-lg hover:shadow-red-500/50" />
    <Button text="Dark" className=" btn-dark hover:shadow-lg hover:shadow-gray-800/20" />
    <Button text="Light" className=" btn-light hover:shadow-lg hover:shadow-gray-400/30" />  
  </>
  )
}
export default GlowButton
`;

export const buttonWithIcon = `
import Button from "@/components/ui/Button'
const ButtonWithIcon = () => {
  return (
    <>
      <Button icon="ph:heart" text="Love" className="btn-primary" />
      <Button icon="ph:pentagram" text="Right Icon" className="btn-secondary" />
      <Button icon="ph:cloud-arrow-down" text="download" className="btn-info" iconPosition="right" />
      <Button icon="ph:trend-up" text="Right Icon" className="btn-warning" iconPosition="right" />
      <Button icon="ph:trash" className="btn-danger" text="Delate" iconPosition="right" />
    </>
  )
}
export default ButtonWithIcon
`;

export const iconButton = `
import Button from "@/components/ui/Button'
const IconButton = () => {
  return (
    <>
      <Button icon="ph:heart" className="btn-primary h-9 w-9 rounded-full p-0" />
      <Button icon="ph:pentagram" className="btn-secondary h-9 w-9 rounded-full p-0" />
      <Button icon="ph:cloud-arrow-down" className="btn-info h-9 w-9 p-0 " />
      <Button icon="ph:trend-up" className="btn-warning h-9 w-9  p-0" />
      <Button icon="ph:trash" className="btn-danger h-9 w-9  p-0" />
    </>
  )
}
export default IconButton
`;

export const buttonSizes = `
import Button from "@/components/ui/Button'
const ButtonSizes = () => {
  return (
    <> 
      <Button text="Button" className="btn-primary px-3 h-6 text-xs " />
      <Button text="Button" className="btn-primary h-8 px-4 text-[13px]" />
      <Button text="Button" className="btn-primary " />
      <Button text="Button" className="btn-primary  h-11  text-base" />
      <Button text="Button" className="btn-primary  h-12  text-base" />
    </>
  )
}
export default ButtonSizes
`;

export const buttonDisabled = `
import Button from "@/components/ui/Button'
const ButtonDisabled = () => {
  return (
    <>  
     <Button text="primary" className="btn-primary " disabled />
     <Button text="secondary" className=" btn-secondary" disabled />
     <Button text="success" className=" btn-success" disabled />
     <Button text="info" className=" btn-info" disabled />
     <Button text="warning" className=" btn-warning" disabled />
     <Button text="error" className=" btn-danger" disabled />
     <Button text="Dark" className=" btn-dark" disabled />
     <Button text="Light" className=" btn-light" disabled /> 
    </>
  )
}
export default ButtonDisabled
`;
export const buttonLoading = `
import Button from "@/components/ui/Button'
const ButtonLoading = () => {
  return (
    <>
     <Button text="primary" className="btn-primary " isLoading />
     <Button text="secondary" className=" btn-secondary" isLoading />
     <Button text="success" className=" btn-success" isLoading />
     <Button text="info" className=" btn-info" isLoading />
     <Button text="warning" className=" btn-warning" isLoading />
     <Button text="error" className=" btn-danger" isLoading />
     <Button text="Dark" className=" btn-dark" isLoading />
     <Button text="Light" className=" btn-light" isLoading />
    </>
  )
}
export default ButtonLoading
`;
