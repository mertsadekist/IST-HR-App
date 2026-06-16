import React from "react";
import Card from "@/components/ui/code-snippet";

import RoundedAvatar from "./rounded-avatar";
import { avatarDots, avatarDotsColor, rounedAvatar, squareAvatar } from "./source-code";
import SquareAvatar from "./square-avatar";
import AvatarDots from "./avatar-dots";
import AvatarDotsColor from "./avatar-dots-color";

const AvatarPage = () => {
  return (
    <div className=" space-y-5">
      <Card title="Rounded Avatar" code={rounedAvatar}>
        <RoundedAvatar />
      </Card>
      <Card title="Square Avatar" code={squareAvatar}>
        <SquareAvatar />
      </Card>
      <Card title="Avatar With Dots" code={avatarDots}>
        <AvatarDots />
      </Card>

      <Card title="Avatar Dot colors" code={avatarDotsColor}>
        <AvatarDotsColor />
      </Card>

    </div>
  );
};

export default AvatarPage;
