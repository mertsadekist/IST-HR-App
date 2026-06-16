import React, { useState } from "react";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import OutLineSpace from "@/components/partials/widget/timeline/outline-space";
// image import
import { Link } from "react-router-dom";
import AreaCurve from "@/components/partials/widget/chart/area-curve";
import OrderChart from "@/components/partials/widget/chart/order-chart";
import TopSeller from "@/components/partials/Table/top-salar";
import ReAreaChart from "../chart/recharts/ReAreaChart";
import VisitorMap from "@/components/partials/widget/map";

const Commerce = () => {
  return (
    <div className=" space-y-5">
      <div className="grid grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5 col-span-12">
          <div className="grid grid-cols-4 gap-5">
            <Card className="text-center py-3 !bg-indigo-500">
              <div className="h-16 w-16 mx-auto rounded-full text-indigo-500  bg-indigo-50 mb-4 text-4xl flex  items-center justify-center">
                <Icon icon="ph:money" />
              </div>
              <div className=" font-bold  text-lg mb-[2px] text-white ">
                22,55252
              </div>
              <div className=" text-sm text-gray-200"> Earn of the Month</div>
            </Card>
            <Card className="text-center py-3 !bg-fuchsia-500">
              <div className="h-16 w-16 mx-auto rounded-full text-fuchsia-500 bg-fuchsia-50 mb-4 text-4xl flex  items-center justify-center">
                <Icon icon="fluent:arrow-growth-24-regular" />
              </div>
              <div className=" font-bold  text-lg mb-[2px]  text-white">
                $5,84,250
              </div>
              <div className=" text-sm text-gray-200"> Earn growth 33%</div>
            </Card>
            <Card className="text-center py-3 !bg-yellow-500">
              <div className="h-16 w-16 mx-auto rounded-full text-yellow-500 bg-yellow-50 mb-4 text-4xl flex  items-center justify-center">
                <Icon icon="carbon:scis-transparent-supply" />
              </div>
              <div className=" font-bold  text-lg mb-[2px] text-white">
                69.5%
              </div>
              <div className=" text-sm text-gray-200">Conversation Rate</div>
            </Card>
            <Card className="text-center py-3 !bg-red-500">
              <div className="h-16 w-16 mx-auto rounded-full text-red-500 bg-red-50 mb-4 text-4xl flex  items-center justify-center">
                <Icon icon="emojione-monotone:money-bag" />
              </div>
              <div className=" font-bold  text-lg mb-[2px] text-white">
                38.05%
              </div>
              <div className=" text-sm text-gray-200"> Gross profit margin</div>
            </Card>
          </div>
          <div className="grid-cols-12 grid gap-5">
            <div className=" lg:col-span-7 col-span-12">
              <Card title="Goal  Completion">
                <AreaCurve />
              </Card>
            </div>
            <div className="lg:col-span-5 col-span-12">
              <Card title="Order Status">
                <OrderChart />
              </Card>
            </div>
          </div>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <Card title="Customer Review" noborder className="col-span-4">
            <div className="flex space-x-4 items-center rtl:space-x-reverse">
              <div className=" shrink-0 text-yellow-500 text-xl flex  space-x-[2px]">
                <Icon icon="ph:star-fill" />
                <Icon icon="ph:star-fill" />
                <Icon icon="ph:star-fill" />
                <Icon icon="ph:star-fill" />
                <Icon icon="ph:star-half-fill" />
              </div>
              <div className="grow space-x-1 rtl:space-x-reverse">
                <span className=" font-bold text-lg text-gray-900 dark:text-white">
                  4.8
                </span>
                <span className=" text-xs text-gray-500 dark:text-gray-400">
                  Out of Five Star
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Overall rating of 100 customer's review
            </div>
            <div className=" space-y-4 mt-10">
              <div className="flex items-center  space-x-4 rtl:space-x-reverse">
                <div className=" shrink-0 text-sm min-w-[70px]">Excellent</div>
                <div className="grow">
                  <ProgressBar
                    value={85}
                    className="bg-green-600  "
                    backClass="bg-green-600/25 rounded-full"
                    active
                  />
                </div>
                <div className=" shrink-0 text-sm ">35</div>
              </div>
              {/* end single progress */}
              <div className="flex items-center  space-x-4 rtl:space-x-reverse">
                <div className=" shrink-0 text-sm min-w-[70px]">Good</div>
                <div className="grow">
                  <ProgressBar
                    value={70}
                    className="bg-green-500"
                    backClass="bg-green-500/25 rounded-full"
                    active
                  />
                </div>
                <div className=" shrink-0 text-sm ">25</div>
              </div>
              {/* end single progress */}
              <div className="flex items-center  space-x-4 rtl:space-x-reverse">
                <div className=" shrink-0 text-sm min-w-[70px]">Average</div>
                <div className="grow">
                  <ProgressBar
                    value={50}
                    className="bg-yellow-500"
                    backClass="bg-yellow-500/25 rounded-full"
                    active
                  />
                </div>
                <div className=" shrink-0 text-sm ">20</div>
              </div>
              {/* end single progress */}
              <div className="flex items-center  space-x-4 rtl:space-x-reverse">
                <div className=" shrink-0 text-sm min-w-[70px]">Avg Below</div>
                <div className="grow">
                  <ProgressBar
                    value={40}
                    className="bg-yellow-600"
                    backClass="bg-yellow-600/25 rounded-full"
                    active
                  />
                </div>
                <div className=" shrink-0 text-sm ">15</div>
              </div>
              {/* end single progress */}
              <div className="flex items-center  space-x-4 rtl:space-x-reverse">
                <div className=" shrink-0 text-sm min-w-[70px]">Poor</div>
                <div className="grow">
                  <ProgressBar
                    value={20}
                    className="bg-red-600"
                    backClass="bg-red-600/25 rounded-full"
                    active
                  />
                </div>
                <div className=" shrink-0 text-sm ">05</div>
              </div>
              {/* end single progress */}
            </div>
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 my-8">
              Here is the result for the latest Responsible would recommended
              this 100's customer's
            </div>
            <Link
              href="#"
              className=" btn btn-primary light w-full  text-center block md:max-w-[80%] mx-auto rounded-full mb-2"
            >
              See All Customer's Reviews
            </Link>
          </Card>
        </div>
      </div>
      {/* end grid */}
      <div className=" grid grid-cols-12 gap-5">
        <div className="lg:col-span-5 col-span-12">
          <Card title=" top Seller">
            <TopSeller />
          </Card>
        </div>
        <div className="lg:col-span-7 col-span-12">
          <Card title="Website Visitor performance ">
            <ReAreaChart height={290} />
          </Card>
        </div>
        <div className="lg:col-span-6 col-span-12">
          <Card title="Activity">
            <OutLineSpace />
          </Card>
        </div>
        <div className="lg:col-span-6 col-span-12">
          <Card title="Visitors by Location">
            <VisitorMap />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Commerce;
