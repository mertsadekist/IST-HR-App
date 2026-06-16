import React, { Fragment } from "react";

import Card from "@/components/ui/Card";
import InputGroup from "@/components/ui/InputGroup";
import Icon from "@/components/ui/Icon";
import { Tab } from "@headlessui/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
const faqmenus = [
  {
    title: "Getting started",
    icon: "ph:trend-up",
  },
  {
    title: "Shipping",
    icon: "ph:car-profile",
  },
  {
    title: "Payments",
    icon: "ph:credit-card",
  },
];
const items = [
  {
    title: "Question 1",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
  {
    title: "Question 2",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
  {
    title: "Question 3",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
  {
    title: "Question 4",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
  {
    title: "Question 5",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
];
const items2 = [
  {
    title: "Question 1",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
  {
    title: "Question 2",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
];
const items3 = [
  {
    title: "Question 1",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
  {
    title: "Question 2",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
  {
    title: "Question 3",
    content:
      "Jornalists call this critical, introductory section the  and when bridge properly executed, it's the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.",
  },
];

const FaqPage = () => {
  return (
    <div>
      <div className="text-center mb-12 space-y-5">
        <h4>How we can help you?</h4>
        <div className="max-w-sm mx-auto">
          <InputGroup
            type="text"
            className=""
            placeholder="Search your Question's"
            prepend={<Icon icon="circum:search" />}
            merged
          />
        </div>
      </div>
      <Tab.Group>
        <div className="grid gap-5 grid-cols-12">
          <div className="xl:col-span-3 lg:col-span-4 col-span-12 card-auto-height">
            <Card>
              <Tab.List className="flex flex-col space-y-1 text-start items-start">
                {faqmenus.map((item, i) => (
                  <Tab key={i} as={Fragment}>
                    {({ selected }) => (
                      <button
                        className={`focus:ring-0 focus:outline-none  space-x-2 text-sm flex items-center w-full transition duration-150 px-3 py-2 rounded-[6px] rtl:space-x-reverse
                            ${
                              selected
                                ? "text-indigo-500"
                                : " text-gray-600  dark:text-gray-300"
                            }
                         `}
                        type="button"
                      >
                        <Icon icon={item.icon} className="text-lg" />
                        <span> {item.title}</span>
                      </button>
                    )}
                  </Tab>
                ))}
              </Tab.List>
            </Card>
          </div>
          <div className="xl:col-span-9 lg:col-span-8 col-span-12">
            <Card>
              <Tab.Panels>
                <Tab.Panel>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>Is it accessible?</AccordionTrigger>
                      <AccordionContent>
                        Yes. It adheres to the WAI-ARIA design pattern.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>Is it styled?</AccordionTrigger>
                      <AccordionContent>
                        Yes. It comes with default styles that matches the other
                        components&apos; aesthetic.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger>Is it animated?</AccordionTrigger>
                      <AccordionContent>
                        Yes. It&apos;s animated by default, but you can disable
                        it if you prefer.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Tab.Panel>
                <Tab.Panel>
                  <Accordion type="single" collapsible className="w-full">
                    {items?.map((item, i) => (
                      <AccordionItem value={`item-${i + 1}`}>
                        <AccordionTrigger>{item.title}</AccordionTrigger>
                        <AccordionContent>{item.content}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </Tab.Panel>
                <Tab.Panel>
                  <Accordion type="single" collapsible className="w-full">
                    {items?.map((item, i) => (
                      <AccordionItem value={`item-${i + 1}`}>
                        <AccordionTrigger>{item.title}</AccordionTrigger>
                        <AccordionContent>{item.content}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </Tab.Panel>
              </Tab.Panels>
            </Card>
          </div>
        </div>
      </Tab.Group>
    </div>
  );
};

export default FaqPage;
