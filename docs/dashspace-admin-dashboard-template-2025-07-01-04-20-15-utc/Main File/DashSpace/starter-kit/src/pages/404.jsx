import React from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import ErrorImage from "@/assets/images/all-img/404.svg";

function Error() {
  const { isAuth, user } = useSelector((state) => state.auth);
  return (
    <div className="min-h-screen flex flex-col justify-center items-center text-center py-20 container mx-auto ">
      <div className="max-w-[546px] mx-auto w-full mt-12">
        <img src={ErrorImage} alt="" className=" h-[250px] mx-auto" />
        <h4 className="  capitalize text-4xl my-4">
          <span className=" text-5xl text-red-500 font-bold">404</span> - Page
          Not Found
        </h4>
        <div className=" text-base font-normal mb-10">
          The page you are looking for does not exist. Please check the URL or
          navigate back to the{" "}
          <Link to={!isAuth ? "/" : "/dashboard"}>Go to homepage</Link>
        </div>
      </div>
      <div className="max-w-[300px] mx-auto w-full">
        <Link
          to={!isAuth ? "/" : "/dashboard"}
          className="btn  btn-primary light transition-all duration-150 block text-center"
        >
          Go to homepage
        </Link>
      </div>
    </div>
  );
}

export default Error;
