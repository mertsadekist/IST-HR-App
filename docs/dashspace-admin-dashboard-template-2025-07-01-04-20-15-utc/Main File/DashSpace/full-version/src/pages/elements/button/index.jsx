import React from "react";
import PlainButton from "./plain-button";
import Card from "@/components/ui/code-snippet";
import { basicButton, buttonDisabled, buttonLoading, buttonSizes, buttonWithIcon, glowButton, iconButton, outlinedButton, roundedButton, softColorButton } from "./source-code";
import RoundedButton from "./rounded-button";
import OutlinedButton from "./outlined-button";
import SoftColorButton from "./soft-color-button";
import GlowButton from "./glow-buttons";
import ButtonWithIcon from "./button-with-icons";
import IconButton from "./icon-button";
import ButtonSizes from "./button-sizes";
import ButtonDisabled from "./button-disabled";
import ButtonLoading from "./button-loading";

const ButtonPage = () => {
  return (
    <div className="space-y-5">
      <Card title="Button" code={basicButton}>
        <PlainButton />
      </Card>
      <Card title="Rounded Button" code={roundedButton}>
        <RoundedButton />
      </Card>
      <Card title="Outlined Button" code={outlinedButton}>
        <OutlinedButton />
      </Card>
      <Card title="Outlined Button" code={softColorButton}>
        <SoftColorButton />
      </Card>
      <Card title="Glow buttons" code={glowButton}>
        <GlowButton />
      </Card>
      <Card title="Button With Icon" code={buttonWithIcon}>
        <ButtonWithIcon />
      </Card>
      <Card title="Button Only Icon" code={iconButton}>
        <IconButton />
      </Card>
      <Card title="Button Size" code={buttonSizes}>
        <ButtonSizes />
      </Card>
      <Card title="Disabled" code={buttonDisabled}>
        <ButtonDisabled />
      </Card>
      <Card title="Loading" code={buttonLoading}>
        <ButtonLoading />
      </Card>
    </div>
  );
};

export default ButtonPage;
