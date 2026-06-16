import React from "react";
import Task from "./Task";
import { Draggable } from "react-beautiful-dnd";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingIcon from "@/components/LoadingIcon";
import BoardHeaderSlot from "./BoardHeaderSlot";

import { useDeleteBoardMutation } from "@/store/api/app/boardApiSlice";
const Board = ({
  board,
  handleAddTaskModal,
  index,
  handleEditBoardModal,
  handleEditTaskModal,
}) => {
  const [deleteBoard, { isLoading: isDeleting }] = useDeleteBoardMutation();
  return (
    <Draggable key={board.id} draggableId={board.id} index={index}>
      {(provided, snapshot) => (
        <div
          className="w-[372px]"
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Card
            title={board.title}
            className={isDeleting && "opacity-50 cursor-not-allowed"}
            headerslot={
              <BoardHeaderSlot
                board={board}
                deleteBoard={deleteBoard}
                handleEditBoardModal={handleEditBoardModal}
              />
            }
          >
            <Task board={board} handleEditTaskModal={handleEditTaskModal} />
            <div className="text-center my-2">
              <Button
                icon="heroicons-outline:plus"
                text=" Add Task"
                className="btn btn-primary light   rounded-full md:max-w-[60%] w-full mx-auto"
                onClick={() => handleAddTaskModal(board.id)}
              />
            </div>
          </Card>
        </div>
      )}
    </Draggable>
  );
};

export default Board;
