import React from 'react';

import Image from "@/components/ui/Image";
import image2 from "@/assets/images/all-img/image-2.png";
import image3 from "@/assets/images/all-img/image-3.png";

const ResponsiveImage = () => {
    return (
        <>
            <span className="block text-base font-medium tracking-[0.01em] dark:text-gray-300 text-gray-500 uppercase mb-6 mt-5">
                Small image with fluid
            </span>
            <Image
                src={image2}
                alt="Small image with fluid:"
                className="rounded-lg mb-6"
            />
            <span className="block text-base font-medium tracking-[0.01em] dark:text-gray-300 text-gray-500 uppercase mb-6 mt-5">
                Large image with fluid-grow:
            </span>
            <Image
                src={image3}
                alt="Small image with fluid-grow:"
                className="rounded-lg w-full "
            />
        </>
    );
};

export default ResponsiveImage;