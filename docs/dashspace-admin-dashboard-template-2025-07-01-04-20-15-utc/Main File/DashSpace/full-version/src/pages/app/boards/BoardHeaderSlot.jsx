import React from "react";
import Icon from "@/components/ui/Icon";
import Dropdown from "@/components/ui/Dropdown";
import { Menu } from "@headlessui/react";
import clsx from "clsx";
const BoardHeaderSlot = ({ board, deleteBoard, handleEditBoardModal }) => {
  const handleDelete = (id) => {
    deleteBoard(id);
  };
  return (
    <div>
      <Dropdown
        classMenuItems=" w-[130px]"
        label={
          <span className="text-xl inline-flex flex-col items-center justify-center  h-6 w-6 bg-gray-100  dark:bg-gray-700 rounded-full  ">
            <Icon icon="ph:dots-three-bold" />
          </span>
        }
      >
        <div>
          <Menu.Item onClick={() => handleEditBoardModal(board)}>
            {({ active }) => (
              <div
                className={clsx(
                  "px-4 py-2 text-sm  text-gray-600 dark:text-gray-300   flex  space-x-2 items-center capitalize rtl:space-x-reverse",
                  {
                    "bg-gray-100 text-gray-900 dark:bg-gray-600 dark:text-gray-300 dark:bg-opacity-50":
                      active,
                  }
                )}
              >
                <span className="text-base">
                  <Icon icon="ph:pencil-simple-line" />
                </span>
                <span>Edit</span>
              </div>
            )}
          </Menu.Item>
          <Menu.Item onClick={() => handleDelete(board.id)}>
            {({ active }) => (
              <div
                className={clsx(
                  "px-4 py-2 text-sm  text-gray-600 dark:text-gray-300   flex  space-x-2 items-center capitalize rtl:space-x-reverse",
                  {
                    "bg-gray-100 text-gray-900 dark:bg-gray-600 dark:text-gray-300 dark:bg-opacity-50":
                      active,
                  }
                )}
              >
                <span className="text-base">
                  <Icon icon="ph:trash" />
                </span>
                <span>Delete</span>
              </div>
            )}
          </Menu.Item>
        </div>
      </Dropdown>
    </div>
  );
};

export default BoardHeaderSlot;
