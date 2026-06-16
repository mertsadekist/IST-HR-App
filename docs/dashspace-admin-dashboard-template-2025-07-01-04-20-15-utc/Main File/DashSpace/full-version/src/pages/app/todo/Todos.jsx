import React from "react";
import Icon from "@/components/ui/Icon";
import Tooltip from "@/components/ui/Tooltip";
import Checkbox from "@/components/ui/Checkbox";
import clsx from "clsx";
import LoadingIcon from "@/components/LoadingIcon";
import {
  useDeleteTodoMutation,
  useEditTodoMutation,
} from "@/store/api/app/todoApiSlice";

const Todos = ({ todo, openEditModal }) => {
  // destructure
  const { id, title, assign, completed, category, favorite } = todo;
  // rtk-query delete
  const [deleteTodo, { isLoading: isDeleting }] = useDeleteTodoMutation();
  const [editTodo, { isLoading: editLoading }] = useEditTodoMutation();

  const handleCompleteChange = () => {
    const updatedTodo = { ...todo, completed: !todo.completed };
    editTodo({ id: todo.id, todo: updatedTodo });
  };

  const handelFav = () => {
    const updatedTodo = { ...todo, favorite: !todo.favorite };
    editTodo({ id: todo.id, todo: updatedTodo });
  };

  const handleDelete = (id) => {
    deleteTodo(id);
  };

  return (
    <>
      <li className="flex items-center px-6 space-x-4 py-6 hover:-translate-y-1 hover:shadow-todo transition-all duration-200 rtl:space-x-reverse">
        <div>
          <Checkbox
            value={completed}
            onChange={handleCompleteChange}
            disabled={editLoading}
          />
        </div>

        <label>
          <input
            type="checkbox"
            className="hidden"
            checked={favorite}
            onChange={handelFav}
          />
          {favorite ? (
            <Icon
              icon="ph:star-fill"
              className="text-xl leading-[1] cursor-pointer text-yellow-500"
            />
          ) : (
            <Icon
              icon="ph:star"
              className="text-xl leading-[1] cursor-pointer opacity-40 dark:text-white"
            />
          )}
        </label>

        <span
          className={` ${
            completed ? "line-through dark:text-gray-300" : ""
          } flex-1 text-sm text-gray-600 dark:text-gray-300 truncate`}
        >
          {title}
        </span>

        <div className="flex">
          <span className="flex-none space-x-1.5 text-base text-gray-400 flex rtl:space-x-reverse">
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
            {category?.map((cta, ctaIndex) => (
              <div key={ctaIndex}>
                {cta && (
                  <>
                    <span
                      className={clsx(
                        "h-2 w-2  capitalize font-normal   rounded-full inline-block ",
                        {
                          "bg-red-500 text-red-500": cta.value === "team",
                          "bg-green-500 text-green-500": cta.value === "low",
                          "bg-yellow-500 text-yellow-500":
                            cta.value === "medium",
                          "bg-indigo-500 text-indigo-500": cta.value === "high",
                          "bg-cyan-500 text-cyan-500": cta.value === "update",
                        }
                      )}
                    ></span>
                  </>
                )}
              </div>
            ))}

            <button
              type="button"
              className="text-gray-400 "
              onClick={() => openEditModal(todo)}
            >
              <Icon icon="ph:pencil-simple-line" />
            </button>
            <button
              type="button"
              className="transition duration-150 hover:text-red-600 text-gray-400 inline-flex items-center"
              onClick={() => handleDelete(todo.id)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <LoadingIcon className="text-red-500  w-8" />
              ) : (
                <Icon icon="ph:trash" />
              )}
            </button>
          </span>
        </div>
      </li>
    </>
  );
};

export default Todos;
