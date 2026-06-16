import React from "react";
const rows = [
  {
    item: "Computer Mouse",
    qty: 2,
    price: "$29.99",
    total: "$59.98",
  },
  {
    item: "Keyboard",
    qty: 1,
    price: "$79.99",
    total: "$79.99",
  },
  {
    item: "Gaming Headset",
    qty: 1,
    price: "$149.99",
    total: "$149.99",
  },
  {
    item: "Wireless Speakers",
    qty: 2,
    price: "$89.99",
    total: "$179.98",
  },
];

const InvoiceTable = () => {
  return (
    <div>
      <table className="w-full border-collapse table-fixed dark:border-gray-700 dark:border">
        <tr className="">
          <th
            colSpan={3}
            className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-xs  font-medium leading-4 uppercase text-gray-600 ltr:text-left ltr:last:text-right rtl:text-right rtl:last:text-left"
          >
            <span className="block px-6 py-5 font-semibold">Product</span>
          </th>
          <th className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-xs  font-medium leading-4 uppercase text-gray-600 ltr:text-left ltr:last:text-right rtl:text-right rtl:last:text-left">
            <span className="block px-6 py-5 font-semibold">Quantity</span>
          </th>
          <th className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-xs  font-medium leading-4 uppercase text-gray-600 ltr:text-left ltr:last:text-right rtl:text-right rtl:last:text-left">
            <span className="block px-6 py-5 font-semibold">PRICE</span>
          </th>
          <th className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300 text-xs  font-medium leading-4 uppercase text-gray-600 ltr:text-left ltr:last:text-right rtl:text-right rtl:last:text-left">
            <span className="block px-6 py-5 font-semibold">TOTAL</span>
          </th>
        </tr>
        {rows.map((data, index) => (
          <tr
            key={index}
            className="border-b border-gray-100 dark:border-gray-700"
          >
            <td
              colSpan={3}
              className="text-gray-900 dark:text-gray-300 text-sm  font-normal ltr:text-left ltr:last:text-right rtl:text-right rtl:last:text-left px-6 py-4"
            >
              {data.item}
            </td>
            <td className="text-gray-900 dark:text-gray-300 text-sm  font-normal ltr:text-left ltr:last:text-right rtl:text-right rtl:last:text-left px-6 py-4">
              {data.qty}
            </td>
            <td className="text-gray-900 dark:text-gray-300 text-sm  font-normal ltr:text-left ltr:last:text-right rtl:text-right rtl:last:text-left px-6 py-4">
              {data.price}
            </td>
            <td className="text-gray-900 dark:text-gray-300 text-sm  font-normal ltr:text-left ltr:last:text-right rtl:text-right rtl:last:text-left px-6 py-4">
              {data.total}
            </td>
          </tr>
        ))}
      </table>
      <div className="md:flex px-6 py-6 items-center">
        <div className="flex-1 text-gray-700 dark:text-gray-300 text-xl">
          Thank you for your purchase!
        </div>
        <div className="flex-none min-w-[270px] space-y-3">
          <div className="flex justify-between">
            <span className="font-medium text-gray-600 text-xs dark:text-gray-300 uppercase">
              subtotal:
            </span>
            <span className="text-gray-900 dark:text-gray-300">$3601.50</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-600 text-xs dark:text-gray-300 uppercase">
              vat (3.5%):
            </span>
            <span className="text-gray-900 dark:text-gray-300">$20.50</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-600 text-xs dark:text-gray-300 uppercase">
              Invoice total:
            </span>
            <span className="text-gray-900 dark:text-gray-300 font-bold">
              $3622.00
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTable;
