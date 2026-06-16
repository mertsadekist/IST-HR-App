import React, { useState, useMemo, useEffect } from "react";
import { UserTable } from "../../../mocks/table-data";
import Avatar from "@/components/ui/Avatar";
import Switch from "@/components/ui/Switch";
import Checkbox from "@/components/ui/Checkbox";
import Icon from "@/components/ui/Icon";
import Dropdown from "@/components/ui/Dropdown";
import Badge from "@/components/ui/Badge";
import { Menu } from "@headlessui/react";
import clsx from "clsx";
import {
  useTable,
  useRowSelect,
  useSortBy,
  useGlobalFilter,
  usePagination,
} from "react-table";
import GlobalFilter from "./GlobalFilter";

const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, checked, onChange, ...rest }, ref) => {
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
          checked={checked}
          onChange={onChange}
          className="table-checkbox"
        />
        {/* <Checkbox
          label="s"
          value={checked}
          onChange={onChange}
          indeterminate={indeterminate}
        /> */}
      </>
    );
  }
);

const UserTable2 = () => {
  const COLUMNS = [
    {
      Header: "#",
      accessor: "id",
      Cell: (row) => {
        return <span>{row?.cell?.value}</span>;
      },
    },

    {
      Header: "User",
      accessor: "user",
      Cell: (row) => {
        return (
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="flex-none">
              <Avatar
                src={row?.cell?.value.avatar}
                alt="name"
                className="w-10 h-10 "
              />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
              {row?.cell?.value.name}
            </span>
          </div>
        );
      },
    },

    {
      Header: "age",
      accessor: "age",
      Cell: (row) => {
        return <span>{row?.cell?.value}</span>;
      },
    },
    {
      Header: "phone",
      accessor: "phone",
      Cell: (row) => {
        return <span>{row?.cell?.value}</span>;
      },
    },

    {
      Header: "role",
      accessor: "role",
      Cell: (row) => {
        return (
          <span className="block w-full">
            <Badge
              label={row?.cell?.value}
              className={clsx(" border  rounded-full ", {
                "border-fuchsia-500 text-fuchsia-500":
                  row?.cell?.value === "superadmin",
                "border-green-500 text-green-500": row?.cell?.value === "admin",
                "border-indigo-500 text-indigo-500":
                  row?.cell?.value === "author",
              })}
            />
          </span>
        );
      },
    },
    {
      Header: "status",
      accessor: "status",
      Cell: (row) => {
        const [checked, setChecked] = useState(row?.cell?.value);

        const handleCheckboxChange = () => {
          const updatedData = [...UserTable];
          updatedData[row.cell.row.index].value = !checked;
          setChecked(!checked);
        };
        return (
          <span>
            <Switch value={checked} onChange={handleCheckboxChange} />
          </span>
        );
      },
    },
    {
      Header: "action",
      accessor: "action",
      Cell: (row) => {
        return (
          <div className="flex space-x-2 rtl:space-x-reverse justify-center">
            <button className="icon-btn" type="button">
              <Icon icon="ph:eye" />
            </button>
            <button className="icon-btn" type="button">
              <Icon icon="ph:pencil-line" />
            </button>
            <button className="icon-btn" type="button">
              <Icon icon="ph:trash" />
            </button>
          </div>
        );
      },
    },
  ];

  const columns = useMemo(() => COLUMNS, []);
  const data = useMemo(() => UserTable, []);

  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: {
        pageSize: 4,
      },
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
      <div className="md:flex justify-between items-center mb-6">
        <h4 className="card-title">User Table</h4>
        <div>
          <GlobalFilter filter={globalFilter} setFilter={setGlobalFilter} />
        </div>
      </div>
      <div className="card">
        <div className="overflow-x-auto rounded-t-lg">
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
                          className=" table-th last:text-center "
                        >
                          {column.render("Header")}
                          <span>
                            {column.isSorted
                              ? column.isSortedDesc
                                ? " 🔽"
                                : " 🔼"
                              : ""}
                          </span>
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
                        className="hover:bg-gray-100 dark:hover:bg-gray-700 hover:bg-opacity-30"
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
        <div className="md:flex md:space-y-0 space-y-5 justify-between mt-6 items-center px-5 pb-5">
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
                      ? "bg-indigo-500  text-white font-medium "
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

export default UserTable2;
