import React from "react";

import User1 from "@/assets/images/users/user-1.jpg";
import User2 from "@/assets/images/users/user-2.jpg";
import User3 from "@/assets/images/users/user-3.jpg";
import User4 from "@/assets/images/users/user-4.jpg";
import User5 from "@/assets/images/users/user-5.jpg";
import User6 from "@/assets/images/users/user-6.jpg";
const timeline = [
  {
    id: 1,
    img: User1,
  },
  {
    id: 2,
    img: User2,
  },
  {
    id: 3,
    img: User3,
  },
  {
    id: 4,
    img: User4,
  },
  {
    id: 5,
    img: User5,
  },
  {
    id: 6,
    img: User6,
  },
  {
    id: 7,
    img: User1,
  },
  {
    id: 6,
    img: User2,
  },
  {
    id: 7,
    img: User3,
  },
  {
    id: 8,
    img: User4,
  },
];

const Recenttimeline = () => {
  return (
    <div>
      <ul className="list-item space-y-3 h-full overflow-x-auto">
        {timeline.map((item, i) => (
          <li
            className="flex items-center space-x-3 rtl:space-x-reverse border-b border-gray-100 dark:border-gray-700 last:border-b-0 pb-3 last:pb-0"
            key={i}
          >
            <div>
              <div className="w-8 h-8 rounded-[100%]">
                <img
                  src={item.img}
                  alt=""
                  className="w-full h-full rounded-[100%] object-cover"
                />
              </div>
            </div>
            <div className="text-start overflow-hidden text-ellipsis whitespace-nowrap max-w-[63%]">
              <div className="text-sm text-gray-600 dark:text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap">
                Finance KPI Mobile app launch preparion meeting.
              </div>
            </div>
            <div className="flex-1 ltr:text-right rtl:text-left">
              <div className="text-sm font-light text-gray-400 dark:text-gray-400">
                1 hours
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Recenttimeline;
