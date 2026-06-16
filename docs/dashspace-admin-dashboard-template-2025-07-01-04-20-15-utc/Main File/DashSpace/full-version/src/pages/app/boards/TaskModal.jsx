import React, { useState } from "react";
import Select, { components } from "react-select";
import Modal from "@/components/ui/Modal";
import Textinput from "@/components/ui/Textinput";
import Textarea from "@/components/ui/Textarea";
import Flatpickr from "react-flatpickr";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import moment from "moment";

import avatar1 from "@/assets/images/avatar/avatar-1.jpg";
import avatar2 from "@/assets/images/avatar/avatar-2.jpg";
import avatar3 from "@/assets/images/avatar/avatar-3.jpg";
import avatar4 from "@/assets/images/avatar/avatar-4.jpg";
import FormGroup from "@/components/ui/FormGroup";

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

const TaskModal = ({ activeModal, onClose, onAdd, task, onEdit }) => {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const FormValidationSchema = yup
    .object({
      title: yup.string().required("Title is required"),
      assign: yup.mixed().required("Assignee is required"),
      startDate: yup
        .date()
        .required("Start date is required")
        .min(new Date(), "Start date must be greater than or equal to today"), // Updated validation rule
      endDate: yup
        .date()
        .required("End date is required")
        .min(
          yup.ref("startDate"),
          "End date must be greater than or equal to start date"
        ), // Added validation rule to ensure end date is greater than or equal to start date
    })
    .required();

  const {
    register,
    control,
    reset,
    formState: { errors },
    handleSubmit,
  } = useForm({
    resolver: yupResolver(FormValidationSchema),
    mode: "all",
  });

  const onSubmit = (data) => {
    const updatedTask = {
      ...task,
      date: new Date(),
      title: data.title,
      priority: "medium",
      startDate: data.startDate,
      endDate: data.endDate,
      assign: data.assign,
    }; // Create the updated todo object

    if (task) {
      onEdit(updatedTask); // Call the edit handler with the updated todo
    } else {
      onAdd({
        date: new Date(),
        title: data.title,
        priority: "high",
        startDate: data.startDate,
        endDate: data.endDate,
        assign: data.assign,
      });
    }

    reset();

    onClose();
    reset();
  };

  return (
    <div>
      <Modal
        title={task ? "Update Task" : "Create Task"}
        activeModal={activeModal}
        onClose={onClose}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 ">
          <Textinput
            name="title"
            label="Project Name"
            placeholder="Project Name"
            register={register}
            defaultValue={task ? task.title : ""}
            error={errors.title}
          />
          <div className="grid lg:grid-cols-2 gap-4 grid-cols-1">
            <FormGroup
              label="Start Date"
              id="default-picker"
              error={errors.startDate}
            >
              <Controller
                name="startDate"
                control={control}
                defaultValue={task ? task.startDate : startDate}
                render={({ field }) => (
                  <Flatpickr
                    className="text-control py-2"
                    id="default-picker"
                    placeholder="yyyy, dd M"
                    value={field.value}
                    onChange={(date) => {
                      field.onChange(date);
                    }}
                    options={{
                      altInput: true,
                      altFormat: "F j, Y",
                      dateFormat: "Y-m-d",
                    }}
                  />
                )}
              />
            </FormGroup>
            <FormGroup
              label="End Date"
              id="default-picker2"
              error={errors.endDate}
            >
              <Controller
                name="endDate"
                control={control}
                defaultValue={task ? task.endDate : endDate}
                render={({ field }) => (
                  <Flatpickr
                    className="text-control py-2"
                    id="default-picker2"
                    placeholder="yyyy, dd M"
                    value={field.value}
                    onChange={(date) => {
                      field.onChange(date);
                    }}
                    options={{
                      altInput: true,
                      altFormat: "F j, Y",
                      dateFormat: "Y-m-d",
                    }}
                  />
                )}
              />
            </FormGroup>
          </div>
          <div className={errors.assign ? "is-error" : ""}>
            <label className="form-label" htmlFor="icon_s">
              Assignee
            </label>
            <Controller
              name="assign"
              control={control}
              defaultValue={task && task.assign ? task.assign : []}
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
          <Textarea label="Descriptions " placeholder="Descriptions" row="5" />
          <div className="ltr:text-right rtl:text-left">
            <button className="btn btn-dark  text-center">
              {task ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TaskModal;
