import React, { useState } from 'react';
import Pagination from "@/components/ui/Pagination";
const PaginationWithBackground = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(6);
  
    const handlePageChange = (page) => {
      setCurrentPage(page);
      // You can add any other logic you need here, such as making an API call to fetch data for the new page
    };
    return (
        <Pagination
            className="bg-gray-100 dark:bg-gray-500  w-fit py-2 px-3 rounded "
            totalPages={totalPages}
            currentPage={currentPage}
            handlePageChange={handlePageChange}
        />
    );
};

export default PaginationWithBackground;