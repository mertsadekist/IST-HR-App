import React, { useState, useEffect } from "react";
import Tooltip from "@/components/ui/Tooltip";
import Icon from "@/components/ui/Icon";

const TaskFooter = ({ task }) => {
  const { assign, startDate, endDate } = task;
  const [start, setStart] = useState(new Date(startDate));
  const [end, setEnd] = useState(new Date(endDate));
  const [totaldays, setTotaldays] = useState(0);

  useEffect(() => {
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setTotaldays(diffDays);
  }, [start, end]);
  return (
    <div className="flex justify-between items-center">
      <div>
        <div className="text-gray-500  text-sm  mb-3">Assigned to</div>
        <div className="flex justify-start -space-x-1.5 min-w-[60px] rtl:space-x-reverse">
          {assign?.map((img, i) => (
            <div
              key={i}
              className="
                   h-6 w-6 rounded-full ring-1 ring-gray-400"
            >
              <Tooltip placement="top" arrow content={img.label}>
                <img
                  src={img.image}
                  alt={img.label}
                  className="w-full h-full rounded-full"
                />
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
      <div className="ltr:text-right rtl:text-left">
        <span className="inline-flex items-center space-x-1 bg-red-500/10 text-red-500 text-xs font-normal px-2 py-1 rounded-full rtl:space-x-reverse">
          <span>
            {" "}
            <Icon icon="heroicons-outline:clock" />
          </span>
          <span>{totaldays}</span>
          <span>days left</span>
        </span>
      </div>
    </div>
  );
};

export default TaskFooter;
