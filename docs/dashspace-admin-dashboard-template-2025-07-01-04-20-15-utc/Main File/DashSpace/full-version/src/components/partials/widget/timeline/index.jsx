import React from "react";

export const lists = [
  {
    title: "User Photo Changed",
    desc: "John Doe changed his avatar",
    time: "12 minute ago",
    status: "gray",
  },
  {
    title: "Task Added",
    desc: "John Doe added new task",
    time: "1 hours ago",
    status: "blue",
  },
  {
    title: "Completed Design ",

    desc: "Nolan completed the design of the Task application",
    time: "3 hours ago",
    status: "green",
  },
  {
    title: "ER Diagram",
    desc: "Team completed the ER diagram app",
    time: "a day ago",
    status: "yellow",
  },
  {
    title: "Weekly Report",

    desc: "The weekly report was uploaded",
    time: "a day ago",
    status: "red",
  },
];
const Timeline = () => {
  return (
    <ol className="relative ltr:pl-2 rtl:pr-2 flex flex-col timeline">
      {lists.map((item, i) => (
        <li
          key={i}
          className="pb-4 relative before:absolute before:inset-0 before:w-[1.5px] before:translate-x-[5px] 
          before:bg-gray-200 before:dark:bg-gray-700  flex flex-1
          timeline-item last:before:h-1/2
          "
        >
          <div
            className={` flex shrink-0 m-0 items-center relative w-3 rounded-full  h-3 
          
           ${item.status === "cyan" ? "bg-cyan-500 " : ""} 
           ${item.status === "gray" ? "bg-gray-300 " : ""} 
                       ${item.status === "blue" ? "bg-indigo-500 " : ""} 
                      ${item.status === "red" ? "bg-red-500 " : ""} 
                      ${item.status === "green" ? "bg-green-500 " : ""}${
              item.status === "yellow" ? "bg-yellow-500 " : ""
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

export default Timeline;
