import React from "react";
import Button from "@/components/ui/Button";
const GlowButton = () => {
  return (
    <div className="space-xy">
      <Button
        text="primary"
        className="btn-primary hover:shadow-lg hover:shadow-indigo-500/50"
      />
      <Button
        text="secondary"
        className=" btn-secondary hover:shadow-lg hover:shadow-fuchsia-500/50"
      />
      <Button
        text="success"
        className=" btn-success hover:shadow-lg hover:shadow-green-500/50"
      />
      <Button
        text="info"
        className=" btn-info hover:shadow-lg hover:shadow-cyan-500/50"
      />
      <Button
        text="warning"
        className=" btn-warning hover:shadow-lg hover:shadow-yellow-500/50"
      />
      <Button
        text="error"
        className=" btn-danger hover:shadow-lg hover:shadow-red-500/50"
      />
      <Button
        text="Dark"
        className=" btn-dark hover:shadow-lg hover:shadow-gray-800/20"
      />
      <Button
        text="Light"
        className=" btn-light hover:shadow-lg hover:shadow-gray-400/30"
      />
    </div>
  );
};

export default GlowButton;
