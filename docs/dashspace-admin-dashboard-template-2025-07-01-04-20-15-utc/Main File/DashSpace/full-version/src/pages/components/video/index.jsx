import React from "react";
import Card from "@/components/ui/code-snippet";
import Video from "./Video";
import { VideoBox } from "./source-code";

const VideoPage = () => {
  return (
    <div className="div">
      <Card title="Video" code={VideoBox}>
        <Video />
      </Card>
    </div>
  );
};

export default VideoPage;
