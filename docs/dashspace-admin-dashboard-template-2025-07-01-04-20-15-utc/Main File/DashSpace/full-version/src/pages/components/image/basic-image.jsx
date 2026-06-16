import React from 'react';
import Image from "@/components/ui/Image";
import image1 from "@/assets/images/all-img/image-1.png";
const BasicImage = () => {
    return (
        <>
            <Image src={image1} alt="image one" className="rounded-lg" />
        </>
    );
};

export default BasicImage;