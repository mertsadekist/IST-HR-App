import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import Select, { components } from "react-select";
import Textinput from "@/components/ui/Textinput";
import Textarea from "@/components/ui/Textarea";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import Flatpickr from "react-flatpickr";
// image import
import avatar1 from "@/assets/images/avatar/avatar-1.jpg";
import avatar2 from "@/assets/images/avatar/avatar-2.jpg";
import avatar3 from "@/assets/images/avatar/avatar-3.jpg";
import avatar4 from "@/assets/images/avatar/avatar-4.jpg";
import Modal from "@/components/ui/Modal";
const FormValidationSchema = yup
  .object({
    title: yup.string().required("Title is required"),
    assign: yup.mixed().required("Assignee is required"),
    tags: yup.mixed().required("Tag is required"),
  })
  .required();

const styles = {
  multiValue: (base, state) => {
    return state.data.isFixed ? { ...base, opacity: "0.5" } : base;
  },
  multiValueLabel: (base, state) => {
    return state.data.isFixed
      ? { ...base, color: "#626262", paddingRight: 6 }
      : base;
  },
  multiValueRemove: (base, state) => {
    return state.data.isFixed ? { ...base, display: "none" } : base;
  },
  option: (provided, state) => ({
    ...provided,
    fontSize: "14px",
  }),
};

const assigneeOptions = [
  { value: "jone", label: "Jone Doe", image: avatar1 },
  { value: "faruk", label: "Faruk", image: avatar2 },
  { value: "hasin", label: "Hasin", image: avatar3 },
  { value: "haq", label: "Salauddin", image: avatar4 },
];
const options = [
  {
    value: "team",
    label: "team",
  },
  {
    value: "low",
    label: "low",
  },
  {
    value: "medium",
    label: "medium",
  },
  {
    value: "high",
    label: "high",
  },
  {
    value: "update",
    label: "update",
  },
];

const OptionComponent = ({ data, ...props }) => {
  //const Icon = data.icon;

  return (
    <components.Option {...props}>
      <span className="flex items-center space-x-4">
        <div className="flex-none">
          <div className="h-7 w-7 rounded-full">
            <img
              src={data.image}
              alt=""
              className="w-full h-full rounded-full"
            />
          </div>
        </div>
        <span className="flex-1">{data.label}</span>
      </span>
    </components.Option>
  );
};
const TodoModal = ({ todo, showModal, onClose, onAdd, onEdit }) => {
  const {
    register,
    control,
    formState: { errors },
    reset,
    handleSubmit,
  } = useForm({
    resolver: yupResolver(FormValidationSchema),
    mode: "all",
  });

  const onSubmit = (data) => {
    const updatedTodo = {
      ...todo,
      title: data.title,
      completed: data.completed,
      assign: data.assign,
      category: data.tags,
    }; // Create the updated todo object

    if (todo) {
      onEdit(updatedTodo); // Call the edit handler with the updated todo
    } else {
      onAdd({
        title: data.title,
        completed: false,
        assign: data.assign,
        category: data.tags,
      }); // Call the add handler with the new todo
    }
  };

  return (
    <Modal
      title={todo ? "Edit Task" : "Add Task"}
      labelclassName="btn-outline-dark"
      activeModal={showModal}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className=" space-y-5">
        <Textinput
          name="title"
          label="title"
          type="text"
          placeholder="Enter title"
          register={register}
          defaultValue={todo ? todo.title : ""}
          error={errors.title}
        />
        <div className={errors.assign ? "is-error" : ""}>
          <label className="form-label" htmlFor="icon_s">
            Assignee
          </label>
          <Controller
            name="assign"
            control={control}
            defaultValue={todo && todo.assign ? todo.assign : []}
            render={({ field }) => (
              <Select
                {...field}
                options={assigneeOptions}
                styles={styles}
                className="react-select"
                classNamePrefix="select"
                isMulti
                components={{
                  Option: OptionComponent,
                }}
                id="icon_s"
              />
            )}
          />
          {errors.assign && (
            <div className=" mt-2  text-red-600 block text-sm">
              {errors.assign?.message || errors.assign?.label.message}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="default-picker" className=" form-label">
            Due Date
          </label>
          <Flatpickr className="text-control py-2" id="default-picker" />
        </div>
        <div className={errors.tags ? "is-error" : ""}>
          <label className="form-label" htmlFor="icon_s">
            Tag
          </label>
          <Controller
            name="tags"
            control={control}
            defaultValue={todo && todo.category ? todo.category : []}
            render={({ field }) => (
              <Select
                {...field}
                options={options}
                styles={styles}
                className="react-select"
                classNamePrefix="select"
                isMulti
                id="icon_s"
              />
            )}
          />
          {errors.assign && (
            <div className=" mt-2  text-red-600 block text-sm">
              {errors.tags?.message || errors.tags?.label.message}
            </div>
          )}
        </div>
        <Textarea label="Description" placeholder="Description" />
        <div className="space-x-3  mt-3 flex justify-end">
          <button type="submit" className="btn btn-primary">
            {todo ? "Save" : "Add"} Task
          </button>
          <button onClick={onClose} className="btn btn-danger">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TodoModal;
