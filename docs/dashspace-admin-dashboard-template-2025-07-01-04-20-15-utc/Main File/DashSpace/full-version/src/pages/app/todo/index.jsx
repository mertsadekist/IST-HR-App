import React, { useState } from "react";
import TodoModal from "./TodoModal";
import Todos from "./Todos";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import LoadingIcon from "@/components/LoadingIcon";
import {
  useGetTodosQuery,
  useAddTodoMutation,
  useEditTodoMutation,
} from "@/store/api/app/todoApiSlice";
import Button from "@/components/ui/Button";
import SimpleBar from "simplebar-react";
import TodoFilter from "./TodoFilter";
const TodoPage = () => {
  // fillter and search
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setsort] = useState("");
  const [filter, setFilter] = useState("all");
  const {
    data: getTodos,
    isLoading,
    isError,
    error,
  } = useGetTodosQuery({
    searchTerm,
    sortBy: sort,
    filter,
  });

  const [showModal, setShowModal] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState(null);

  const [addTodo, { isLoading: addLoading }] = useAddTodoMutation();
  const [editTodo, { isLoading: editLoading }] = useEditTodoMutation();

  const openAddModal = () => {
    setSelectedTodo(null);
    setShowModal(true);
  };

  const todos = getTodos?.todos || [];

  const openEditModal = (todo) => {
    setSelectedTodo(todo);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };
  const handleEditTodo = (updatedTodo) => {
    editTodo({
      id: selectedTodo.id, // Pass the id of the todo to be updated
      todo: updatedTodo,
    });
    closeModal();
  };

  const handleAddTodo = (newTodo) => {
    addTodo(newTodo);
    closeModal();
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  const handlesort = (event) => {
    setsort(event.target.value);
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

  const handleFilterChange = (filter) => {
    setFilter(filter);
    // Perform any other actions based on the filter change
  };

  return (
    <>
      <div className="  todo_height relative rtl:space-x-reverse  space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <Button
              icon="heroicons-outline:plus"
              text="Add Todo"
              isLoading={addLoading}
              className="btn-primary  rounded-full    "
              onClick={openAddModal}
            />
          </div>
          <div className=" flex space-x-2 rtl:space-x-reverse">
            <input
              type="text"
              className="text-control md:min-w-[200px] py-2"
              value={searchTerm}
              placeholder="Search..."
              onChange={handleSearchChange}
            />

            <Select
              value={sort}
              onChange={handlesort}
              className="lg:min-w-[150px]"
            >
              <option value="">Sort By</option>
              <option value="asc">A-Z</option>
              <option value="desc">Z-A</option>
            </Select>
          </div>
        </div>

        <div className="h-full card">
          <SimpleBar className="h-full all-todos overflow-x-hidden">
            <ul className="divide-y divide-slate-100 dark:divide-slate-700  h-full">
              <TodoFilter
                handleFilterChange={handleFilterChange}
                filter={filter}
              />
              {todos.map((todo, i) => (
                <Todos
                  key={i}
                  todo={todo}
                  openEditModal={openEditModal}
                  addLoading={addLoading}
                />
              ))}
              {todos.length === 0 && (
                <li className="mx-6 mt-6">
                  <Alert
                    label="No Result Found"
                    className="alert-danger py-2"
                  />
                </li>
              )}
            </ul>
          </SimpleBar>
        </div>
      </div>
      {showModal && (
        <TodoModal
          todo={selectedTodo}
          onEdit={handleEditTodo} // Pass the edit handler
          onAdd={handleAddTodo} // Pass the add handler
          onClose={closeModal}
          showModal={showModal}
        />
      )}
    </>
  );
};

export default TodoPage;
