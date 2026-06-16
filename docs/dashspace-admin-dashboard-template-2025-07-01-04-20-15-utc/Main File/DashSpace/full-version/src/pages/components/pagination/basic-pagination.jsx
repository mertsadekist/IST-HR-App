import React, { useState } from 'react';
import Pagination from "@/components/ui/Pagination";
const BasicPagination = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(6);

    const handlePageChange = (page) => {
        setCurrentPage(page);
        // You can add any other logic you need here, such as making an API call to fetch data for the new page
    };
    return (
        <>
            <Pagination totalPages={totalPages}  currentPage={currentPage} handlePageChange={handlePageChange}/>
        </>
    );
};

export default BasicPagination;