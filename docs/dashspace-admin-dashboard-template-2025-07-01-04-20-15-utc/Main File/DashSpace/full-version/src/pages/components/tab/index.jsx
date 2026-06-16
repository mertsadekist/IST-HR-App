import React from "react";
import Card from "@/components/ui/code-snippet";
import BasicTabs from "./basic-tabs";
import { basicTab, borderBottomTab, borderBottomWithIcon } from "./source-code";
import BorderBottomTab from "./border-bottom-tab";
import BorderBottomWithIcon from "./border-bottom-with-icon";

const TabPage = () => {
  return (
    <div className=" space-y-5">
      <Card title="Basic Tabs" code={basicTab}>
        <BasicTabs />
      </Card>

      <Card title="Border Bottom" code={borderBottomTab}>
        <BorderBottomTab />
      </Card>

      <Card title="Border Bottom with Icon" code={borderBottomWithIcon}>
        <BorderBottomWithIcon />
      </Card>
    </div>
  );
};

export default TabPage;
