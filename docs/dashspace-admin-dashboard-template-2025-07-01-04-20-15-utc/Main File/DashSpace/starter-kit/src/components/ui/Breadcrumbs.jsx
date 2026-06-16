import React, { useState, useEffect } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { menuItems } from "@/mocks/data";
import Icon from "@/components/ui/Icon";

const Breadcrumbs = () => {
  const location = useLocation();
  const locationName = location.pathname.replace("/", "");

  const [isHide, setIsHide] = useState(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [pageTitle, setPageTitle] = useState("");

  useEffect(() => {
    const currentMenuItem = menuItems.find(
      (item) => item.link === locationName
    );

    const currentChild = menuItems.find((item) =>
      item.child?.find((child) => child.childlink === locationName)
    );

    if (currentMenuItem) {
      setIsHide(currentMenuItem.isHide);
      setPageTitle(currentMenuItem.title);
    } else if (currentChild) {
      setIsHide(currentChild?.isHide || false);
      setGroupTitle(currentChild?.title);
      setPageTitle(locationName);
    }
  }, [location, locationName]);

  return (
    <>
      {!isHide ? (
        <div className=" flex space-x-3 rtl:space-x-reverse mt-2 ">
          <ul className="breadcrumbs">
            <li className="text-indigo-500">
              <NavLink to="/dashboard">Home</NavLink>
              <div className="breadcrumbs-icon"></div>
            </li>
            {groupTitle && (
              <li className="text-indigo-500">
                <button type="button" className="capitalize">
                  {groupTitle}
                </button>
                <div className="breadcrumbs-icon"></div>
              </li>
            )}
            <li className="capitalize text-gray-500 dark:text-gray-400">
              {locationName}
            </li>
          </ul>
        </div>
      ) : (
        <div className="  text-lg font-normal text-gray-900 dark:text-gray-100 truncate max-w-[150px] uppercase ">
          {pageTitle}
        </div>
      )}
    </>
  );
};

export default Breadcrumbs;
