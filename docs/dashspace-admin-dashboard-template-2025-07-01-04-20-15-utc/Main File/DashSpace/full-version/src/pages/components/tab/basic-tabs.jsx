import React, { Fragment, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BasicTabs = () => {
  return (
    <div className="lg:w-7/12">
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent
          elementum finibus arcu vitae scelerisque. Etiam rutrum blandit
          condimentum. Maecenas condimentum massa vitae quam interdum, et
          lacinia urna tempor",
        </TabsContent>
        <TabsContent value="password">
          Etiam nec ante eget lacus vulputate egestas non iaculis tellus.
          Suspendisse tempus ex in tortor venenatis malesuada. Aenean consequat
          dui vitae nibh lobortis condimentum. Duis vel risus est
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BasicTabs;
