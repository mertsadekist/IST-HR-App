import React from "react";
import Card from "@/components/ui/Card";
import UserTable from "./react-tables/UserTable";
import UserTable2 from "./react-tables/UserTable2";

const TableAdvancedPage = () => {
  return (
    <div className=" space-y-5">
      <UserTable />
      <UserTable2 />
    </div>
  );
};

export default TableAdvancedPage;
