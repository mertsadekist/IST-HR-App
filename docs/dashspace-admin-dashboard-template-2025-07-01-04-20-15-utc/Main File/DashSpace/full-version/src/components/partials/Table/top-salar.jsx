import React from "react";
import Avatar from "@/components/ui/Avatar";
import user1 from "@/assets/images/avatar/avatar.jpg";
import user2 from "@/assets/images/avatar/avatar-1.jpg";
import user3 from "@/assets/images/avatar/avatar-2.jpg";
import user4 from "@/assets/images/avatar/avatar-3.jpg";
import Usa from "@/assets/images/flags/usa.svg";
import Brasil from "@/assets/images/flags/bra.svg";
import Japan from "@/assets/images/flags/japan.svg";
import Italy from "@/assets/images/flags/italy.svg";
const columns = [
  {
    label: "Profile",
  },

  {
    label: "Company",
  },
  {
    label: "Product",
  },
];
const rows = [
  {
    id: 1,
    name: "Mark Otto",
    country: {
      flag: Usa,
      name: "Usa",
    },
    customer: {
      name: "Mona Miha",
      image: user1,
    },
    product: "2020",
  },
  {
    id: 2,
    name: "Jacob Thornton	",
    country: {
      flag: Brasil,
      name: "Brasil",
    },
    customer: {
      name: "Picki Witsha",
      image: user2,
    },
    product: "2022",
  },
  {
    id: 3,
    name: "Mark Otto",
    country: {
      flag: Japan,
      name: "Japan",
    },
    customer: {
      name: "Jenny Wilson",
      image: user3,
    },
    product: "2024",
  },
  {
    id: 4,
    name: "Larry the	",
    country: {
      flag: Brasil,
      name: "Brasil",
    },

    customer: {
      name: "John Doe",
      image: user4,
    },
    product: "2018",
  },
];
const TopSeller = () => {
  return (
    <div className="overflow-x-auto ">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden ">
          <table className="min-w-full divide-y divide-gray-100 table-fixed dark:divide-gray-700">
            <thead className="">
              <tr>
                {columns.map((column, i) => (
                  <th key={i} scope="col" className=" table-th px-0 ">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="py-3">
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                      <div className="flex-none">
                        <Avatar
                          src={row?.customer.image}
                          alt="name"
                          imageClass="rounded-lg"
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                        {row?.customer.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 ">
                    <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
                      <div className="flex-none w-5 h-5">
                        <img
                          src={row?.country.flag}
                          alt=""
                          className=" w-full h-full  object-cover object-center"
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                        {row?.country.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 ">{row.product}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TopSeller;
