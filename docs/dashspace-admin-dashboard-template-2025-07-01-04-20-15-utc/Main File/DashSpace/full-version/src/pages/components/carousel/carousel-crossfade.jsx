import React from 'react';
import Carousel from "@/components/ui/Carousel";
import { SwiperSlide } from "swiper/react";

// import images
import c1 from "@/assets/images/all-img/c1.png";
import c2 from "@/assets/images/all-img/c2.png";
import c3 from "@/assets/images/all-img/c3.png";
const CarouselCrossfade = () => {
    return (
        <Carousel
            pagination={true}
            navigation={true}
            className="main-caro"
            effect={"fade"}
        >
            <SwiperSlide>
                <div
                    className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
                    style={{
                        backgroundImage: `url(${c1})`,
                    }}
                ></div>
            </SwiperSlide>
            <SwiperSlide>
                <div
                    className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
                    style={{
                        backgroundImage: `url(${c2})`,
                    }}
                ></div>
            </SwiperSlide>
            <SwiperSlide>
                <div
                    className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
                    style={{
                        backgroundImage: `url(${c3})`,
                    }}
                ></div>
            </SwiperSlide>
        </Carousel>
    );
};

export default CarouselCrossfade;