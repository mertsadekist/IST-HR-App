import React from "react";

import Card from "@/components/ui/code-snippet";

// Image Import

import BasicImage from "./basic-image";
import { basicImage, responsiveImage, responsiveImageV2 } from "./source-code";
import ResponsiveImage from "./responsive-image";
import ResponsiveImageV2 from "./responsive-image-v2";


const PageIimage = () => {
    return (
        <div>
            <div className="space-y-5">
                <Card title="Images" code={basicImage}>
                    <BasicImage />
                </Card>
                <Card title="Responsive images" code={responsiveImage}>
                    <ResponsiveImage />
                </Card>
                <Card title="Responsive images" code={responsiveImageV2}>
                    <ResponsiveImageV2/>
                </Card>
            </div>
        </div>
    );
};

export default PageIimage;
