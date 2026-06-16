import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Textinput from "@/components/ui/Textinput";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

const FormValidationSchema = yup
  .object({
    title: yup.string().required("Title is required"),
  })
  .required();

const BoardModal = ({ board, activeModal, onClose, onAdd, onEdit }) => {
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
    const updatedBoard = {
      ...board,
      title: data.title,
    }; // Create the updated todo object

    if (board) {
      onEdit(updatedBoard); // Call the edit handler with the updated todo
    } else {
      onAdd({
        title: data.title,
      }); // Call the add handler with the new todo
    }

    reset();
  };

  return (
    <div>
      <Modal
        title={board ? "Edit Board Name" : "Create New Board"}
        activeModal={activeModal}
        onClose={onClose}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 ">
          <Textinput
            name="title"
            label="Name"
            placeholder="Name"
            register={register}
            defaultValue={board ? board.title : ""}
            error={errors.title}
          />

          <div className="ltr:text-right rtl:text-left">
            <button className="btn btn-dark  text-center">
              {board ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default BoardModal;
