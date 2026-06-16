import React, { useState } from "react";
import InputGroup from "@/components/ui/InputGroup";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useNavigate } from "react-router-dom";
import Checkbox from "@/components/ui/Checkbox";
import { useRegisterUserMutation } from "@/store/api/auth/authApiSlice";
import { toast } from "react-toastify";

const schema = yup
  .object({
    name: yup.string().required("Name is Required"),
    email: yup.string().email("Invalid email").required("Email is Required"),
    password: yup
      .string()
      .min(6, "Password must be at least 8 characters")
      .max(20, "Password shouldn't be more than 20 characters")
      .required("Please enter password"),
    // confirm password
    confirmpassword: yup
      .string()
      .oneOf([yup.ref("password"), null], "Passwords must match"),
  })
  .required();

const RegForm = () => {
  const [registerUser, { isLoading, isError, error, isSuccess }] =
    useRegisterUserMutation();

  const [checked, setChecked] = useState(false);
  const {
    register,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm({
    resolver: yupResolver(schema),
    mode: "all",
  });

  const navigate = useNavigate();

  const onSubmit = async (data) => {
    try {
      const response = await registerUser(data);
      if (response.error) {
        throw new Error(response.error.message);
      }
      reset();
      navigate("/");
      toast.success("Add Successfully");
    } catch (error) {
      console.log(error.response); // Log the error response to the console for debugging

      const errorMessage =
        error.response?.data?.message ||
        "An error occurred. Please try again later.";

      if (errorMessage === "Email is already registered") {
        toast.error(errorMessage);
      } else {
        toast.warning(errorMessage);
      }
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 ">
      <InputGroup
        name="name"
        type="text"
        prepend={<Icon icon="ph:lock-simple" />}
        placeholder=" Enter your name"
        register={register}
        error={errors.name}
        disabled={isLoading}
        merged
      />
      <InputGroup
        name="email"
        type="email"
        prepend={<Icon icon="ph:lock-simple" />}
        placeholder=" Enter your email"
        register={register}
        error={errors.email}
        disabled={isLoading}
        merged
      />
      <InputGroup
        name="password"
        type="password"
        prepend={<Icon icon="ph:lock-simple" />}
        placeholder=" Enter your password"
        register={register}
        error={errors.password}
        merged
        disabled={isLoading}
      />
      <Checkbox
        label="I agree with privacy policy"
        value={checked}
        onChange={() => setChecked(!checked)}
      />

      <Button
        type="submit"
        text="Create an account"
        className="btn btn-primary block w-full text-center "
        isLoading={isLoading}
      />
    </form>
  );
};

export default RegForm;
