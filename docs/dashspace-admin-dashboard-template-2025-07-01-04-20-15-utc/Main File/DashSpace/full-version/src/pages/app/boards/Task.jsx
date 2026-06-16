import React, { useState } from "react";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import TaskHeader from "./TaskHeader";
import TaskFooter from "./TaskFooter";
import clsx from "clsx";
import { Droppable, Draggable } from "react-beautiful-dnd";

const Task = ({ board, handleEditTaskModal }) => {
  return (
    <Droppable
      droppableId={board?.id?.toString()}
      type="task"
      direction="vertical"
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`px-2 py-4 h-full space-y-4  -mx-3 ${
            snapshot.isDraggingOver && "bg-indigo-100"
          }`}
        >
          {board.tasks && board.tasks.length > 0 ? (
            <>
              {board.tasks?.map((task, j) => (
                <Draggable key={j} draggableId={task.id} index={j}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <Card>
                        <TaskHeader
                          task={task}
                          board={board}
                          handleEditTaskModal={handleEditTaskModal}
                        />
                        <Badge
                          className={clsx("px-6 rounded-full mt-3 ", {
                            "bg-indigo-500/10 text-indigo-500":
                              task.priority === "high",
                            "bg-yellow-500/10 text-yellow-500":
                              task.priority === "medium",
                            "bg-red-500/10 text-red-500":
                              task.priority === "low",
                          })}
                          label={task.priority}
                        />
                        <div className=" text-gray-800 dark:text-white font-medium capitalize text-sm my-4">
                          {task.title}
                        </div>
                        <TaskFooter task={task} />
                      </Card>
                    </div>
                  )}
                </Draggable>
              ))}
            </>
          ) : (
            <p className="   capitalize rounded-md  text-gray-500 text-sm 3 cursor-not-allowed">
              {snapshot.isDraggingOver ? "Drop Here..." : "No task found..."}
            </p>
          )}

          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
};

export default Task;
