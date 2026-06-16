export const basicTab = `import React, { Fragment, useState } from "react";

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
`;

export const borderBottomTab = `import React, { Fragment } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const buttons = [
  {
    title: "home",
    icon: "ph:house-line",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent elementum finibus arcu vitae scelerisque. Etiam rutrum blandit condimentum. Maecenas condimentum massa vitae quam interdum, et lacinia urna tempor",
  },
  {
    title: "profile",
    icon: "ph:user",
    content:
      "Pellentesque pulvinar, sapien eget fermentum sodales, felis lacus viverra magna, id pulvinar odio metus non enim. Ut id augue interdum, ultrices felis eu, tincidunt libero.",
  },
  {
    title: "messages",
    icon: "ph:chat-dots",
    content:
      "Cras iaculis ipsum quis lectus faucibus, in mattis nulla molestie. Vestibulum vel tristique libero. Morbi vulputate odio at viverra sodales. Curabitur accumsan justo eu libero porta ultrices vitae eu leo.",
  },
  {
    title: "settings",
    icon: "ph:gear-six",
    content:
      "Etiam nec ante eget lacus vulputate egestas non iaculis tellus. Suspendisse tempus ex in tortor venenatis malesuada. Aenean consequat dui vitae nibh lobortis condimentum. Duis vel risus est",
  },
];

const BorderBottomTab = () => {
  return (
    <div className="lg:w-7/12">
      <Tabs defaultValue="home">
        <TabsList className=" bg-transparent p-0 border-b-2 border-gray-200 rounded-none">
          {buttons.map((item, i) => (
            <>
              <TabsTrigger
                className="capitalize   data-[state=active]:bg-transparent data-[state=active]:text-indigo-500 transition duration-150 before:transition-all before:duration-150 relative before:absolute
         before:left-1/2 before:-bottom-[5px] before:h-[2px]
           before:-translate-x-1/2 before:w-0 data-[state=active]:before:bg-indigo-500 data-[state=active]:before:w-full"
                value={item.title}
              >
                {item.title}
              </TabsTrigger>
            </>
          ))}
        </TabsList>
        {buttons.map((item, i) => (
          <>
            <TabsContent value={item.title}>{item.content}</TabsContent>
          </>
        ))}
      </Tabs>
    </div>
  );
};

export default BorderBottomTab;`;

export const borderBottomWithIcon = `import React, { Fragment } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Icon from "@/components/ui/Icon";
const buttons = [
  {
    title: "home",
    icon: "ph:house-line",
    content:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent elementum finibus arcu vitae scelerisque. Etiam rutrum blandit condimentum. Maecenas condimentum massa vitae quam interdum, et lacinia urna tempor",
  },
  {
    title: "profile",
    icon: "ph:user",
    content:
      "Pellentesque pulvinar, sapien eget fermentum sodales, felis lacus viverra magna, id pulvinar odio metus non enim. Ut id augue interdum, ultrices felis eu, tincidunt libero.",
  },
  {
    title: "messages",
    icon: "ph:chat-dots",
    content:
      "Cras iaculis ipsum quis lectus faucibus, in mattis nulla molestie. Vestibulum vel tristique libero. Morbi vulputate odio at viverra sodales. Curabitur accumsan justo eu libero porta ultrices vitae eu leo.",
  },
  {
    title: "settings",
    icon: "ph:gear-six",
    content:
      "Etiam nec ante eget lacus vulputate egestas non iaculis tellus. Suspendisse tempus ex in tortor venenatis malesuada. Aenean consequat dui vitae nibh lobortis condimentum. Duis vel risus est",
  },
];

const BorderBottomWithIcon = () => {
  return (
    <div className="lg:w-7/12">
      <Tabs defaultValue="home">
        <TabsList className=" bg-transparent p-0 border-b-2 border-gray-200 rounded-none">
          {buttons.map((item, i) => (
            <>
              <TabsTrigger
                className="capitalize   data-[state=active]:bg-transparent data-[state=active]:text-indigo-500 transition duration-150 before:transition-all before:duration-150 relative before:absolute
         before:left-1/2 before:-bottom-[5px] before:h-[2px]
           before:-translate-x-1/2 before:w-0 data-[state=active]:before:bg-indigo-500 data-[state=active]:before:w-full"
                value={item.title}
              >
                <Icon
                  icon={item.icon}
                  className="h-5 w-5 top-[1px] ltr:mr-[6px] rtl:ml-[6px] relative"
                />
                {item.title}
              </TabsTrigger>
            </>
          ))}
        </TabsList>
        {buttons.map((item, i) => (
          <>
            <TabsContent value={item.title}>{item.content}</TabsContent>
          </>
        ))}
      </Tabs>
    </div>
  );
};

export default BorderBottomWithIcon;`;
