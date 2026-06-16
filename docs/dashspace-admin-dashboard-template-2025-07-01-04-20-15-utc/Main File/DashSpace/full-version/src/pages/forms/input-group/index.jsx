import React from "react";
import Card from "@/components/ui/code-snippet";
import BasicInputGroup from "./basic-input-group";
import { basicInputGroups, mergedAddon } from "./source-code";
import MergedAddon from "./merged-addon";

const InputGroupPage = () => {
    return (
        <div className=" space-y-5">
            <Card title="Input Group" code={basicInputGroups}>
                <BasicInputGroup />
            </Card>
            <Card title="Merged Addon" code={mergedAddon}>
                <MergedAddon />
            </Card>
        </div>
    );
};

export default InputGroupPage;
