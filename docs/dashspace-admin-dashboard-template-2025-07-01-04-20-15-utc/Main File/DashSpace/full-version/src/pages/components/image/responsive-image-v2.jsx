import React from 'react';
import Image from "@/components/ui/Image";
import responsiveImage1 from "@/assets/images/all-img/thumb-1.png";
import responsiveImage2 from "@/assets/images/all-img/thumb-2.png";
import responsiveImage3 from "@/assets/images/all-img/thumb-3.png";
import responsiveImage4 from "@/assets/images/all-img/thumb-4.png";
import responsiveImage5 from "@/assets/images/all-img/thumb-5.png";
import responsiveImage6 from "@/assets/images/all-img/thumb-6.png";
const ResponsiveImageV2 = () => {
    const images = [
        {
            src: responsiveImage1,
        },
        {
            src: responsiveImage2,
        },
        {
            src: responsiveImage3,
        },
        {
            src: responsiveImage4,
        },
        {
            src: responsiveImage5,
        },
        {
            src: responsiveImage6,
        },
    ];
    return (
        <div className="grid xl:grid-cols-6 lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-5">
        {images.map((item, i) => (
            <Image
                src={item.src}
                alt="thumb-1"
                className="rounded-lg border-4 border-gray-300"
                key={i}
            />
        ))}
    </div>
    );
};

export default ResponsiveImageV2;