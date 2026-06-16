import React, { useState, useMemo } from "react";
import { invoiceTable } from "../../mocks/table-data";
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
import GlobalFilter from "../table/react-tables/GlobalFilter";

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

const InvoicePage = () => {
  const navigate = useNavigate();
  const actions = [
    {
      name: "send",
      icon: "ph:paper-plane-right",
      doit: () => {
        navigate("/add-invoice");
      },
    },
    {
      name: "view",
      icon: "ph:eye",
      doit: () => {
        navigate("/invoice-preview");
      },
    },
    {
      name: "edit",
      icon: "ph:pencil-line",
      doit: (id) => {
        navigate("/edit-invoice");
      },
    },
    {
      name: "delete",
      icon: "ph:trash",
      doit: (id) => {
        return null;
      },
    },
    {
      name: "download",
      icon: "ph:download",
      doit: (id) => {
        return null;
      },
    },
  ];
  const COLUMNS = [
    {
      Header: "invoice ID",
      accessor: "order",
      Cell: (row) => {
        return (
          <span className="  text-sm">
            #EKG4
            {row?.cell?.value}
          </span>
        );
      },
    },
    {
      Header: "Client",
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
              className={` h-2 w-2  rounded-full inline-block ring-[4px]     ${
                row?.cell?.value === "paid"
                  ? " bg-green-500 ring-green-500/30"
                  : ""
              } 
            ${
              row?.cell?.value === "due"
                ? " bg-yellow-500  ring-yellow-500/30"
                : ""
            }
            ${
              row?.cell?.value === "canceled"
                ? " bg-red-500 ring-red-500/30"
                : ""
            }
            
             `}
            ></span>
            <span>{row?.cell?.value}</span>
          </span>
        );
      },
    },
    {
      Header: "action",
      accessor: "action",
      Cell: (row) => {
        return (
          <div className=" text-center">
            <Dropdown
              classMenuItems="right-0 w-[140px] top-[110%] "
              label={
                <span className="text-lg text-center   h-7 w-7 inline-flex justify-center items-center  bg-transparent hover:bg-gray-200 transition-all duration-200 rounded-full leading-none  ">
                  <Icon icon="heroicons-outline:dots-horizontal" />
                </span>
              }
            >
              <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white">
                {actions.map((item, i) => (
                  <div key={i} onClick={() => item.doit()}>
                    <div
                      className={`
                
                 hover:bg-indigo-500/10  hover:text-indigo-500 
                   w-full border-b border-b-gray-400 border-opacity-10 px-4 py-2 text-sm  last:mb-0 cursor-pointer 
                   first:rounded-t last:rounded-b flex  space-x-2 items-center rtl:space-x-reverse `}
                    >
                      <span className="text-base">
                        <Icon icon={item.icon} />
                      </span>
                      <span className=" text-sm">{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Dropdown>
          </div>
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
    useRowSelect,

    (hooks) => {
      hooks.visibleColumns.push((columns) => [
        {
          id: "selection",
          Header: ({ getToggleAllRowsSelectedProps }) => (
            <div>
              <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
            </div>
          ),
          Cell: ({ row }) => (
            <div>
              <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
            </div>
          ),
        },
        ...columns,
      ]);
    }
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
      <Card noborder>
        <div className="md:flex pb-6 items-center">
          <h6 className="flex-1 md:mb-0 mb-3">Invoice</h6>
          <div className="md:flex md:space-x-3 items-center flex-none rtl:space-x-reverse md:space-y-0 space-y-5">
            <GlobalFilter filter={globalFilter} setFilter={setGlobalFilter} />

            <Button
              icon="ph:plus"
              text="Add Record"
              className=" btn-primary font-normal  min-h-[42px]"
              iconClass="text-lg"
              onClick={() => {
                navigate("/add-invoice");
              }}
            />
          </div>
        </div>
        <div className="overflow-x-auto -mx-5">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden ">
              <table
                className="min-w-full divide-y divide-gray-100 table-fixed dark:divide-gray-700"
                {...getTableProps}
              >
                <thead className="bg-gray-100 dark:bg-gray-700 ">
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
        <div className="md:flex md:space-y-0 space-y-5 justify-between mt-6 items-center">
          <div className=" flex items-center space-x-3 rtl:space-x-reverse">
            <span className=" flex space-x-2  rtl:space-x-reverse items-center">
              <span className=" text-sm font-medium text-gray-600 dark:text-gray-300">
                Go
              </span>
              <span>
                <input
                  type="number"
                  className=" text-control py-2"
                  defaultValue={pageIndex + 1}
                  onChange={(e) => {
                    const pageNumber = e.target.value
                      ? Number(e.target.value) - 1
                      : 0;
                    gotoPage(pageNumber);
                  }}
                  style={{ width: "50px" }}
                />
              </span>
            </span>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              Page{" "}
              <span>
                {pageIndex + 1} of {pageOptions.length}
              </span>
            </span>
          </div>
          <ul className="flex items-center  space-x-3  rtl:space-x-reverse">
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
      </Card>
    </>
  );
};

export default InvoicePage;
