import React from "react";
import Card from "@/components/ui/Card";
import CardBox from "@/components/ui/code-snippet";

// import images
import cardImage1 from "@/assets/images/all-img/card-1.png";
import cardImage2 from "@/assets/images/all-img/card-2.png";
import cardImage3 from "@/assets/images/all-img/card-3.png";

const exampleCard1 = [
  {
    title: "Primary Card",
    bg: "bg-indigo-500",
    color: "text-indigo-500",
  },
  {
    title: "Secondary Card ",
    bg: "bg-fuchsia-500",
    color: "text-fuchsia-500",
  },
  {
    title: "Success Card",
    bg: "bg-green-500",
    color: "text-green-500",
  },
  {
    title: "Danger Card",
    bg: "bg-red-500",
    color: "text-red-500",
  },
  {
    title: "Warning Card",
    bg: "bg-yellow-500",
    color: "text-yellow-500",
  },
  {
    title: "Info Card",
    bg: "bg-cyan-500",
    color: "text-cyan-500",
  },
];
const exampleCard2 = [
  {
    title: "Primary Card",
    ring: "ring-fuchsia-500",
  },
  {
    title: "Secondary Card ",
    ring: "ring-gray-500",
  },
  {
    title: "Success Card",
    ring: "ring-green-500",
  },
  {
    title: "Danger Card",
    ring: "ring-red-500",
  },
  {
    title: "Warning Card",
    ring: "ring-yellow-500",
  },
  {
    title: "Info Card",
    ring: "ring-cyan-500",
  },
];

import {
  exampleCard,
  exampleCard1 as ex1code,
  exampleCard2 as ex2code,
} from "./source-code";
const card = () => {
  return (
    <div className=" space-y-5">
      <CardBox title="Basic Cards" code={exampleCard}>
        <div className="grid xl:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-5 card-height-auto">
          <Card bodyClass="p-0">
            <div className="h-[180px] w-full">
              <img
                src={cardImage1}
                alt=""
                className="block w-full h-full object-cover rounded-t-md"
              />
            </div>
            <div className="px-6 py-4 space-y-4">
              <header>
                <div className="card-title">Card title</div>
              </header>
              <div className="text-sm">
                Some quick example text to build on the card title and make up
                the bulk of the card's content.
              </div>
              <button className="btn btn-primary text-center">
                Go somewhere
              </button>
            </div>
          </Card>

          <Card bodyClass="p-0">
            <div className="h-[180px] w-full">
              <img
                src={cardImage2}
                alt=""
                className="block w-full h-full object-cover rounded-t-md"
              />
            </div>
            <div className="px-6 py-4 space-y-4">
              <header>
                <div className="card-title">Card title</div>
              </header>
              <div className="text-sm">
                Some quick example text to build on the card title and make up
                the bulk of the card's content. Some quick example text to build
                on the card title and make up the bulk of the card's content.
                Some quick example text to build on the card title and
              </div>
            </div>
          </Card>

          <Card bodyClass="p-0">
            <div className="h-[180px] w-full">
              <img
                src={cardImage3}
                alt=""
                className="block w-full h-full object-cover rounded-t-md"
              />
            </div>
            <div className="px-6 py-4 space-y-4">
              <header>
                <div className="card-title">Card title</div>
              </header>
              <div className="text-sm">
                Some quick example text to build on the card title and make up
                the bulk of the card's content.
              </div>
              <hr className="border-t border-b-0 -mx-5 border-gray-10" />
              <div className=" flex space-x-4 rtl:space-x-reverse text-sm  ">
                <a href="#" className=" text-indigo-500 underline">
                  Custom Links1
                </a>
                <a href="#" className=" text-indigo-500 underline">
                  Custom Links2
                </a>
              </div>
            </div>
          </Card>
        </div>
      </CardBox>
      <CardBox title="Color Cards" code={ex1code}>
        <div className="grid xl:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-5">
          {exampleCard1.map((item, i) => (
            <Card
              title={item.title}
              className={`!${item.bg} dark:${item.bg}`}
              titleClass="text-white"
              noborder
              key={i}
            >
              <div className="text-white text-sm">
                Some quick example text to build on the card title and make up
                the bulk of the card's content.
              </div>
            </Card>
          ))}
        </div>
      </CardBox>
      <CardBox title="Border Cards" code={ex2code}>
        <div className="grid xl:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-5">
          {exampleCard2.map((item, i) => (
            <Card
              noborder
              title={item.title}
              className={`ring-1 ${item.ring}`}
              key={i}
            >
              <div className="text-sm">
                Some quick example text to build on the card title and make up
                the bulk of the card's content.
              </div>
            </Card>
          ))}
        </div>
      </CardBox>
    </div>
  );
};

export default card;
