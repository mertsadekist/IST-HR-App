import React, { useState, useRef, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingIcon from "@/components/LoadingIcon";

import {
  useGetBoardsQuery,
  useCreateTaskMutation,
  useCreateBoardMutation,
  useDeleteBoardMutation,
  useEditBoardMutation,
  useEditTaskMutation,
} from "@/store/api/app/boardApiSlice";

import BoardModal from "./BoardModal";
import ModalTask from "./TaskModal";
import Board from "./Board";
import Task from "./Task";
import BoardHeaderSlot from "./BoardHeaderSlot";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

const KanbanPage = () => {
  // local state
  // board  state
  const boardRef = useRef(null);
  const [boardModal, setBoardModal] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState(null);
  // task state
  const [taskModal, setTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [boardId, setBoardId] = useState(null);

  const {
    data: boards = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetBoardsQuery();

  //const boards = getBoards?.boards || [];
  const [createBoard, { isLoading: addLoading }] = useCreateBoardMutation();
  const [createTask, { isLoading: taskLoading }] = useCreateTaskMutation();
  const [editBoard] = useEditBoardMutation();
  const [editTask] = useEditTaskMutation();

  // board handler
  const handleAddBoardModal = () => {
    setSelectedBoard(null);
    setBoardModal(true);
  };

  const handleAddBoard = (newBoard) => {
    createBoard(newBoard);
    setBoardModal(false);
  };
  const handleEditBoardModal = (board) => {
    setSelectedBoard(board);
    setBoardModal(true);
  };

  const handleEditBoard = (updatedBoard) => {
    editBoard({
      boardId: selectedBoard.id, // Pass the id of the todo to be updated
      board: updatedBoard,
    });
    setBoardModal(false);
  };
  // task handler
  const handleAddTaskModal = (id) => {
    setSelectedTask(null);
    setTaskModal(true);
    setBoardId(id);
  };
  const handleEditTaskModal = (task) => {
    setSelectedTask(task);
    setTaskModal(true);
  };
  const handleCreateTask = (data) => {
    const newTask = {
      title: data.title,
      date: new Date(),
      priority: data.priority,
      startDate: data.startDate,
      endDate: data.endDate,
      assign: data.assign,
    };
    createTask({ boardId, ...newTask });
    setTaskModal(false);
  };
  const handleEditTask = (updatedTask) => {
    editTask({
      boardId: updatedTask.boardId,
      taskId: selectedTask.id,
      task: updatedTask,
    });

    setTaskModal(false);
  };
  const [localBoards, setLocalBoards] = useState(null);

  useEffect(() => {
    if (boards && boards.length > 0) {
      setLocalBoards(boards);
    }
    boardRef.current?.lastElementChild?.scrollIntoView({
      behavior: "smooth",
      inline: "end",
    });
  }, [boards, isLoading, isError]);
  const onDragEnd = (result) => {
    const { destination, source, draggableId, type } = result;

    // Check if the item was dropped outside of a droppable area
    if (!destination) {
      return;
    }

    // Check if the item was dropped in a different position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Handle the logic based on the type of drag and drop (board or task)
    if (type === "list") {
      // Reorder boards
      const updatedBoards = Array.from(localBoards);
      const movedBoard = updatedBoards.splice(source.index, 1)[0];
      updatedBoards.splice(destination.index, 0, movedBoard);
      setLocalBoards(updatedBoards);
    } else if (type === "task") {
      // Reorder tasks within a board
      const sourceBoardIndex = localBoards.findIndex(
        (board) => board.id === source.droppableId
      );
      const destinationBoardIndex = localBoards.findIndex(
        (board) => board.id === destination.droppableId
      );

      if (sourceBoardIndex === destinationBoardIndex) {
        // Reorder tasks within the same board
        const updatedBoards = Array.from(localBoards);
        const board = { ...updatedBoards[sourceBoardIndex] };
        const tasks = Array.from(board.tasks);
        const movedTask = tasks.splice(source.index, 1)[0];
        tasks.splice(destination.index, 0, movedTask);
        board.tasks = tasks;
        updatedBoards[sourceBoardIndex] = board;
        setLocalBoards(updatedBoards);
      } else {
        // Move task to a different board
        const updatedBoards = Array.from(localBoards);
        const sourceBoard = { ...updatedBoards[sourceBoardIndex] };
        const destinationBoard = { ...updatedBoards[destinationBoardIndex] };
        const sourceTasks = Array.from(sourceBoard.tasks);
        const destinationTasks = Array.from(destinationBoard.tasks);
        const movedTask = sourceTasks.splice(source.index, 1)[0];
        destinationTasks.splice(destination.index, 0, movedTask);
        sourceBoard.tasks = sourceTasks;
        destinationBoard.tasks = destinationTasks;
        updatedBoards[sourceBoardIndex] = sourceBoard;
        updatedBoards[destinationBoardIndex] = destinationBoard;
        setLocalBoards(updatedBoards);
      }
    }
  };

  if (isLoading) {
    return (
      <Card className="todo_height">
        <LoadingIcon className="text-indigo-500 h-20 w-20" />
      </Card>
    );
  }
  if (isError) {
    return <div>Error:</div>;
  }

  return (
    <div>
      <div className="flex  justify-end mb-4">
        <Button
          icon="heroicons-outline:plus"
          text="Add Board"
          className="btn btn-primary"
          onClick={handleAddBoardModal}
          isLoading={addLoading}
        />
      </div>
      <div>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="all-lists" direction="horizontal" type="list">
            {(provided, snapshot) => (
              <div
                // ref={provided.innerRef}
                ref={(ref) => {
                  boardRef.current = ref;
                  provided.innerRef(ref);
                }}
                {...provided.droppableProps}
                className="flex space-x-6  overflow-x-auto pb-4 rtl:space-x-reverse"
              >
                {localBoards?.map((board, i) => {
                  return (
                    <div key={i}>
                      <Board
                        handleAddTaskModal={handleAddTaskModal}
                        board={board}
                        index={i}
                        key={i}
                        handleEditBoardModal={handleEditBoardModal}
                        handleEditTaskModal={handleEditTaskModal}
                      />
                    </div>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {boardModal && (
        <BoardModal
          board={selectedBoard}
          onEdit={handleEditBoard}
          onAdd={handleAddBoard}
          activeModal={boardModal}
          onClose={() => setBoardModal(!boardModal)}
        />
      )}
      {taskModal && (
        <ModalTask
          task={selectedTask}
          activeModal={taskModal}
          onAdd={handleCreateTask}
          onEdit={handleEditTask}
          onClose={() => setTaskModal(!taskModal)}
        />
      )}
    </div>
  );
};

export default KanbanPage;
