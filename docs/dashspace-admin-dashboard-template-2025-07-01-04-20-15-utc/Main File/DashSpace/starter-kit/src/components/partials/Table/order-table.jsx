import React, { useState, useMemo } from "react";
import { invoiceTable } from "@/mocks/table-data";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Dropdown from "@/components/ui/Dropdown";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";

import { useNavigate } from "react-router-dom";
import {
  useTable,
  useRowSelect,
  useSortBy,
  useGlobalFilter,
  usePagination,
} from "react-table";

const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, ...rest }, ref) => {
    const defaultRef = React.useRef();
    const resolvedRef = ref || defaultRef;

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate;
    }, [resolvedRef, indeterminate]);

    return (
      <>
        <input
          type="checkbox"
          ref={resolvedRef}
          {...rest}
          className="table-checkbox"
        />
      </>
    );
  }
);

const RecentOrderTable = () => {
  const navigate = useNavigate();

  const COLUMNS = [
    {
      Header: "ID",
      accessor: "order",
      Cell: (row) => {
        return (
          <span className="  text-sm text-indigo-500">
            #EKG4
            {row?.cell?.value}
          </span>
        );
      },
    },
    {
      Header: "Customer",
      accessor: "customer",
      Cell: (row) => {
        return (
          <div className="flex items-start space-x-3 rtl:space-x-reverse">
            <div className="flex-none">
              <Avatar src={row?.cell?.value.image} alt="name" />
            </div>
            <div>
              <span className="text-sm text-gray-600 dark:text-gray-300 capitalize block">
                {row?.cell?.value.name}
              </span>
              <span className=" text-xs text-gray-500 dark:text-gray-400 font-light mt-[1px] block lowercase">
                example@gmail.com
              </span>
            </div>
          </div>
        );
      },
    },
    {
      Header: "Created Date",
      accessor: "date",
      Cell: (row) => {
        return <div className="">{row?.cell?.value}</div>;
      },
    },
    {
      Header: "due Date",
      accessor: "quantity",
      Cell: (row) => {
        return <div className="">20-10-2023</div>;
      },
    },
    {
      Header: "price",
      accessor: "amount",
      Cell: (row) => {
        return <div className="">{row?.cell?.value}</div>;
      },
    },
    {
      Header: "status",
      accessor: "status",
      Cell: (row) => {
        return (
          <span className="block w-full  space-x-3">
            <span
              className={` h-2 w-2  rounded-full inline-block      ${
                row?.cell?.value === "paid" ? " bg-green-500" : ""
              } 
            ${row?.cell?.value === "due" ? " bg-yellow-500  " : ""}
            ${row?.cell?.value === "canceled" ? " bg-red-500 " : ""}
            
             `}
            ></span>
            <span
              className={`  ${
                row?.cell?.value === "paid" ? " text-green-500" : ""
              } 
            ${row?.cell?.value === "due" ? " text-yellow-500  " : ""}
            ${row?.cell?.value === "canceled" ? " text-red-500 " : ""}`}
            >
              {row?.cell?.value}
            </span>
          </span>
        );
      },
    },
  ];

  const columns = useMemo(() => COLUMNS, []);
  const data = useMemo(() => invoiceTable, []);

  const tableInstance = useTable(
    {
      columns,
      data,
    },

    useGlobalFilter,
    useSortBy,
    usePagination,
    useRowSelect
  );
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    footerGroups,
    page,
    nextPage,
    previousPage,
    canNextPage,
    canPreviousPage,
    pageOptions,
    state,
    gotoPage,
    pageCount,
    setPageSize,
    setGlobalFilter,
    prepareRow,
  } = tableInstance;

  const { globalFilter, pageIndex, pageSize } = state;

  return (
    <>
      <div className="card">
        <div className="overflow-x-auto ">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden ">
              <table
                className="min-w-full divide-y divide-gray-100 table-fixed dark:divide-gray-700"
                {...getTableProps}
              >
                <thead className=" bg-gray-100 dark:bg-gray-700 ">
                  {headerGroups.map((headerGroup) => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                      {headerGroup.headers.map((column) => (
                        <th
                          {...column.getHeaderProps(
                            column.getSortByToggleProps()
                          )}
                          scope="col"
                          className=" table-th "
                        >
                          <div className="flex items-center justify-between ">
                            {column.render("Header")}
                            <span>
                              {column.isSorted ? (
                                column.isSortedDesc ? (
                                  <Icon icon="ph:caret-up-fill" />
                                ) : (
                                  <Icon icon="ph:caret-down-fill" />
                                )
                              ) : (
                                <Icon
                                  icon="ri:expand-up-down-fill"
                                  className="text-[15px] text-gray-400"
                                />
                              )}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700"
                  {...getTableBodyProps}
                >
                  {page.map((row) => {
                    prepareRow(row);
                    return (
                      <tr
                        {...row.getRowProps()}
                        className="hover:bg-gray-100 dark:hover:bg-gray-700 hover:bg-opacity-30  transition-all duration-200"
                      >
                        {row.cells.map((cell) => {
                          return (
                            <td {...cell.getCellProps()} className="table-td">
                              {cell.render("Cell")}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="p-6">
          <ul className="flex items-center  justify-center space-x-3  rtl:space-x-reverse">
            <li className="text-xl leading-4 text-gray-900 dark:text-white rtl:rotate-180">
              <button
                className={` ${
                  !canPreviousPage ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={() => previousPage()}
                disabled={!canPreviousPage}
              >
                <Icon icon="heroicons-outline:chevron-left" />
              </button>
            </li>
            {pageOptions.map((page, pageIdx) => (
              <li key={pageIdx}>
                <button
                  href="#"
                  aria-current="page"
                  className={` ${
                    pageIdx === pageIndex
                      ? "bg-indigo-500 text-white font-medium "
                      : "bg-gray-100 dark:bg-gray-700 dark:text-gray-400 text-gray-900  font-normal  "
                  }    text-sm rounded leading-[16px] flex h-6 w-6 items-center justify-center transition-all duration-150`}
                  onClick={() => gotoPage(pageIdx)}
                >
                  {page + 1}
                </button>
              </li>
            ))}
            <li className="text-xl leading-4 text-gray-900 dark:text-white rtl:rotate-180">
              <button
                className={` ${
                  !canNextPage ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={() => nextPage()}
                disabled={!canNextPage}
              >
                <Icon icon="heroicons-outline:chevron-right" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default RecentOrderTable;
