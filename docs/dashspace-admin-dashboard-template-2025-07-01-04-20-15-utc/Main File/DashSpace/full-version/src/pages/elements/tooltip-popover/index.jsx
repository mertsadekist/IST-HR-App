import React from "react";
import Card from "@/components/ui/code-snippet";
import BasicTooltip from "./basic-tooltip";
import { animatedTooltip, basicTooltip, htmlContentTooltip, interactiveTooltip, positionsTooltip, triggerTooltip } from "./source-code";
import PositionsTooltip from "./postions-tooltip";
import AnimatedTooltip from "./animated-tooltip";
import TriggerTooltip from "./trigger-tooltip";
import InteractiveTooltip from "./interactive-tooltip";
import HTMLContentTooltip from "./html-content-tooltip";

const TooltipPage = () => {
    return (
        <div className=" space-y-5">

            <Card title="Basic Tooltip" code={basicTooltip}>
                <BasicTooltip />
            </Card>

            <Card title="Tooltip Position" code={positionsTooltip}>
                <PositionsTooltip />
            </Card>

            <Card title="Animations" code={animatedTooltip}>
                <AnimatedTooltip />
            </Card>

            <Card title="Triggers" code={triggerTooltip}>
                <TriggerTooltip />
            </Card>
            <Card title="Interactive" code={interactiveTooltip}>
                <InteractiveTooltip />
            </Card>
            <Card title="HTML Content" code={htmlContentTooltip}>
                <HTMLContentTooltip />
            </Card>

        </div>
    );
};

export default TooltipPage;
