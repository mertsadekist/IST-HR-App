import React from "react";
import Card from "@/components/ui/code-snippet";
import BasicPagination from "./basic-pagination";
import { basicPagination, paginationWithBackground, paginationWithText } from "./source-code";
import PaginationWithBackground from "./pagination-with-background";
import PaginationWithText from "./pagination-with-text";

const PaginationPage = () => {

  return (
    <div className="space-y-5" >
      <Card title="Basic Pagination" code={basicPagination}>
        <BasicPagination />
      </Card>
      <Card title="Pagination With Background" code={paginationWithBackground}>
        <PaginationWithBackground />
      </Card>
      <div>
        <Card title="Pagination With Text" code={paginationWithText}>
          <PaginationWithText />
        </Card>
      </div>
    </div>
  );
};

export default PaginationPage;
