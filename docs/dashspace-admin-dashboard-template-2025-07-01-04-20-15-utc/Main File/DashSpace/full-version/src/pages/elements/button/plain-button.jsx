import React from "react";
import Button from "@/components/ui/Button";
const PlainButton = () => {
  return (
    <div className="space-xy">
      <Button text="primary" className="btn-primary " />
      <Button text="secondary" className="btn-secondary" />
      <Button text="success" className="btn-success" />
      <Button text="info" className="btn-info" />
      <Button text="warning" className="btn-warning" />
      <Button text="error" className="btn-danger" />
      <Button text="Dark" className="btn-dark" />
      <Button text="Light" className="btn-light" />
    </div>
  );
};

export default PlainButton;
