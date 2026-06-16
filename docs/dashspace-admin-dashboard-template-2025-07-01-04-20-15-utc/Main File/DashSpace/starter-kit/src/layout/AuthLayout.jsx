import React, { useEffect, Suspense } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import Loading from "@/components/Loading";
const AuthLayout = () => {
  const navigate = useNavigate();

  return (
    <div className="auth-wrapper">
      <div className="auth-page-height">
        <Suspense fallback={<Loading />}>
          <ToastContainer />
          {<Outlet />}
        </Suspense>
      </div>
    </div>
  );
};

export default AuthLayout;
