import React from "react";

export const lists = [
  {
    title: "New Product Added",
    desc: "Product ABC added to the inventory",
    time: "2 minute ago",
    status: "gray",
  },
  {
    title: "Product Purchased",
    desc: "Customer John Doe purchased Product XYZ",
    time: "1 hours ago",
    status: "blue",
  },
  {
    title: "Product Sold ",

    desc: "Product XYZ sold to Customer Jane Smith",
    time: "3 hours ago",
    status: "green",
  },
  {
    title: "Product Purchased",
    desc: "Customer Alex Johnson purchased Product DEF",
    time: "a day ago",
    status: "yellow",
  },
  {
    title: "New Product Added",

    desc: "Product GHI added to the inventory",
    time: "a day ago",
    status: "red",
  },
];
const OutLineSpace = () => {
  return (
    <ol className="relative ltr:pl-2 rtl:pr-2 flex flex-col timeline">
      {lists.map((item, i) => (
        <li
          key={i}
          className="pb-4 relative before:absolute before:inset-0 before:bottom-3  before:top-[calc(12px+12px)]  before:w-[1.5px] before:translate-x-[5px] 
          before:bg-gray-200 before:dark:bg-gray-700  flex flex-1
          timeline-item last:before:h-1/2
          "
        >
          <div
            className={` flex shrink-0 m-0 items-center relative w-3 rounded-full  h-3 ring-2
          
           ${item.status === "cyan" ? "ring-cyan-500 " : ""} 
           ${item.status === "gray" ? "ring-gray-300 " : ""} 
                       ${item.status === "blue" ? "ring-indigo-500 " : ""} 
                      ${item.status === "red" ? "ring-red-500 " : ""} 
                      ${item.status === "green" ? "ring-green-500 " : ""}${
              item.status === "yellow" ? "ring-yellow-500 " : ""
            }
          `}
          ></div>
          <div className=" relative  pl-8 flex-1   space-y-1">
            <div className="text-sm leading-none font-medium dark:text-gray-400-900 pb-1  text-gray-700 dark:text-white">
              {item.title}
            </div>
            <p className="text-sm    text-gray-600 pb-1.5 leading-none dark:text-gray-300">
              {item.desc}
            </p>
            <p className="text-xs  text-gray-500 dark:text-gray-400 leading-none">
              {item.time}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
};

export default OutLineSpace;
