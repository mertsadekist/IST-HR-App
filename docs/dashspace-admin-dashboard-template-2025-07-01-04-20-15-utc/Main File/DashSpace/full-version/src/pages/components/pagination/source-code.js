export const basicPagination = `
import Pagination from "@/components/ui/Pagination";
const BasicPagination = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(6);
  return (
    <>
       <Pagination totalPages={totalPages}  currentPage={currentPage} handlePageChange={handlePageChange} />
    </>
  )
}
export default BasicPagination
`;
export const paginationWithBackground = `
import Pagination from "@/components/ui/Pagination";
const PaginationWithBackground = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(6);
  return (
    <>
    <Pagination
    className="bg-gray-100 dark:bg-gray-500  w-fit py-2 px-3 rounded "
    totalPages={totalPages}
    currentPage={currentPage}
    handlePageChange={handlePageChange}
/>
    </>
  )
}
export default PaginationWithBackground
`;
export const paginationWithText = `
import Pagination from "@/components/ui/Pagination";
const PaginationWithBackground = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(6);
  return (
    <>
    
    <Pagination
    text
    totalPages={totalPages}
    currentPage={currentPage}
    handlePageChange={handlePageChange}
/>
    </>
  )
}
export default PaginationWithBackground
`;