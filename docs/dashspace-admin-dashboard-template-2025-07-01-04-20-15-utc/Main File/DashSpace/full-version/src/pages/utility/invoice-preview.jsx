import React from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import InvoiceTable from "./InvoiceTable";
import userDarkMode from "@/hooks/useDarkMode";

// import images
import MainLogo from "@/assets/images/logo/logo-c.svg";
import LogoWhite from "@/assets/images/logo/logo-white.svg";

const InvoicePreviewPage = () => {
  const printPage = () => {
    window.print();
  };
  const [isDark] = userDarkMode();

  return (
    <div>
      <Card>
        <div className="max-w-[90%] mx-auto">
          <img src={MainLogo} alt="" />
          <div className="lg:flex lg:space-x-3 lg:space-y-0 space-y-3 my-6">
            <div className="flex-1">
              <div className=" text-sm ">
                <strong>Hello Charles Hall</strong>, <br />
                This is the receipt for a payment of $268.00 (USD) you made to
                DashSpace - Admin Dashboard Demo.
              </div>
            </div>
            <div className="flex-none flex items-center space-x-3 rtl:space-x-reverse">
              <Button
                icon="ph:printer"
                text="Print"
                onClick={printPage}
                className="btn-primary light"
              />
              <Button
                icon="ph:cloud-arrow-down"
                text="download"
                className="btn-primary"
                iconPosition="right"
              />
            </div>
          </div>
          <div className="md:flex  justify-between mt-10 ">
            <div className="mb-5">
              <div className=" text-sm mb-1"> Payment No</div>
              <div className=" text-lg font-semibold text-gray-800 dark:text-white">
                741037024
              </div>
            </div>
            <div className="mb-5 md:text-end">
              <div className=" text-sm mb-1">Payment date</div>
              <div className="text-lg font-semibold text-gray-800 dark:text-white">
                October 2, 2021 - 03:45 pm
              </div>
            </div>
          </div>
          <hr className=" border-gray-10  my-10" />
          <div className="md:flex space-x-6 justify-between rtl:space-x-reverse md:space-y-0 space-y-5 mb-10 ">
            <div className="text-gray-500 dark:text-gray-300 font-normal leading-5  text-sm">
              <span className="block text-gray-900 dark:text-gray-300 font-medium leading-5 mb-4 text-lg">
                Company
              </span>
              Street Address State, <br /> City Region, <br /> Postal Code{" "}
              <br />
              ltd@example.com
            </div>
            <div className="md:text-end">
              <span className="block text-gray-900 dark:text-gray-300 font-medium leading-5 text-lg">
                Client
              </span>

              <div className="text-gray-500 dark:text-gray-300 font-normal leading-5 mt-4 text-sm">
                Street Address State, <br /> City Region, <br /> Postal Code{" "}
                <br />
                ltd@example.com
              </div>
            </div>
          </div>
          <div className="">
            <InvoiceTable />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default InvoicePreviewPage;
