import React from "react";
import Card from "@/components/ui/code-snippet";
import BasicProgress from "./basic-progress";
import { activeProgress, animatedStripped, basicProgressBar, multipleBarProgressBar, progressSize, progressStripped, progressValue, softColorProgressBar } from "./source-code";
import SoftColorProgressBar from "./soft-color-progressbar";
import ProgressSize from "./progress-size";
import ProgressStriped from "./progress-striped";
import ActiveProgress from "./active-progress";
import AnimatedStripped from "./animated-strepped";
import ProgressValue from "./progress-value";
import MultipleBarProgressbar from "./multiple-bar-progressbar";

const ProgressbarPage = () => {
  return (
    <div className=" space-y-5">

      <Card title="Basic Progress" code={basicProgressBar}>
        <BasicProgress />
      </Card>

      <Card title="Soft Color Progress" code={softColorProgressBar}>
        <SoftColorProgressBar />
      </Card>

      <Card title="Progress Sizes" code={progressSize}>
        <ProgressSize />
      </Card>

      <Card title="Striped Examples" code={progressStripped}>
        <ProgressStriped />
      </Card>

      <Card title="Active Progress" code={activeProgress}>
        <ActiveProgress />
      </Card>

      <Card title="Animated Striped Examples" code={animatedStripped}>
        <AnimatedStripped />
      </Card>

      <Card title="Value Examples" code={progressValue}>
        <ProgressValue />
      </Card>

      <Card title="Multiple Bar Examples" code={multipleBarProgressBar}>
        <MultipleBarProgressbar />
      </Card>
      
    </div>
  );
};

export default ProgressbarPage;
