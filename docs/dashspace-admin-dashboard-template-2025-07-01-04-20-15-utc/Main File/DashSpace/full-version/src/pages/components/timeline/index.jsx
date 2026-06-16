import React from "react";
import Timeline from "@/components/partials/widget/timeline";
import TimeLineLineSpace from "@/components/partials/widget/timeline/line-space";
import OutLineSpace from "@/components/partials/widget/timeline/outline-space";
import Card from "@/components/ui/Card";

const TimelinePage = () => {
  return (
    <div className=" space-y-5">
      <Card title="Basic Timeline">
        <div className="mt-6">
          <Timeline />
        </div>
      </Card>
      <Card title="With Linespace">
        <div className="mt-6">
          <TimeLineLineSpace />
        </div>
      </Card>
      <Card title="Outline Space">
        <div className="mt-6">
          <OutLineSpace />
        </div>
      </Card>
    </div>
  );
};

export default TimelinePage;
