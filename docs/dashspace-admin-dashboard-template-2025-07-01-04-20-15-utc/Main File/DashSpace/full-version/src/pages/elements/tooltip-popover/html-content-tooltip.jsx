import React from 'react';
import Tooltip from "@/components/ui/Tooltip";
import UserAvatar from "@/assets/images/avatar/avatar.jpg";
const HTMLContentTooltip = () => {
    return (
        <div className="space-xy flex flex-wrap">
            <Tooltip
                title="Html Content"
                placement="top"
                arrow
                allowHTML
                interactive
                theme="dark"
                maxWidth="320px"
                content={
                    <div className="flex items-center -[-9px] text-gray-100">
                        <div className="flex-none ltr:mr-[10px] rtl:ml-[10px]">
                            <div className="h-[46px] w-[46px] rounded-full">
                                <img
                                    src={UserAvatar}
                                    alt=""
                                    className="block w-full h-full object-cover rounded-full"
                                />
                            </div>
                        </div>
                        <div className="flex-1  text-sm font-semibold  ">
                            <span className=" truncate w-full block">Faruk Ahamed</span>
                            <span className="block font-light text-xs   capitalize">
                                supper admin
                            </span>
                        </div>
                    </div>
                }
                className="btn btn-light"
            ></Tooltip>
        </div>
    );
};

export default HTMLContentTooltip;