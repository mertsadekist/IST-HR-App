import React from "react";
import Card from "@/components/ui/code-snippet";
import BasicBadge from "./basic-badge";
import { badgeWithIcon, basicBadge, glowBadge, outlineBadge, roundedBadge, softColorBadge } from "./source-code";
import RoundedBadge from "./rounded-badge";
import GlowBadge from "./glow-badge";
import SoftColorBadge from "./soft-color-badge";
import OutlineBadge from "./outline-badge";
import BadgeWithIcon from "./badge-with-icon";

const badges = () => {
    return (
        <div className=" space-y-5">
            <Card title="Basic Badges" code={basicBadge}>
                <BasicBadge />
            </Card>
            <Card title="Rounded Badge" code={roundedBadge}>
                <RoundedBadge />
            </Card>
            <Card title="Glow Badge" code={glowBadge}>
                <GlowBadge />
            </Card>
            <Card title="Soft Color Badge" code={softColorBadge}>
                <SoftColorBadge />
            </Card>

            <Card title="Outlined Badge" code={outlineBadge}>
                <OutlineBadge />
            </Card>

            <Card title="Badges With Icon" code={badgeWithIcon}>
                <BadgeWithIcon />
            </Card>
        </div>
    );
};

export default badges;
