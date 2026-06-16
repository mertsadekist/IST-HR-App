export const carouselBasic = `
import Carousel from "@/components/ui/Carousel";
import { SwiperSlide } from "swiper/react";

// import images

import c1 from "@/assets/images/all-img/c1.png";
import c2 from "@/assets/images/all-img/c2.png";
import c3 from "@/assets/images/all-img/c3.png";

const CarouselBasic = () => {

  return (
    <>
    <Carousel pagination={true} navigation={true} className="main-caro">
    <SwiperSlide>
      <div
        className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
        style={{
          backgroundImage: \`url(\${ c1 })\`,
        }}
      ></div>
    </SwiperSlide>
    <SwiperSlide>
      <div
        className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
        style={{
          backgroundImage: \`url(\${ c2 })\`,
        }}
      ></div>
    </SwiperSlide>
    <SwiperSlide>
      <div
        className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
        style={{
          backgroundImage: \`url(\${ c3 })\`,
        }}
      ></div>
    </SwiperSlide>
  </Carousel>
    </>
  )
}
export default CarouselBasic
`;

export const carouselInterval = `
import Carousel from "@/components/ui/Carousel";
import { SwiperSlide } from "swiper/react";

// import images
import c1 from "@/assets/images/all-img/c1.png";
import c2 from "@/assets/images/all-img/c2.png";
import c3 from "@/assets/images/all-img/c3.png";

const CarouselInterval = () => {

  return (
    <>
    <Carousel
    pagination={true}
    navigation={true}
    className="main-caro"
    autoplay={{
        delay: 2500,
        disableOnInteraction: false,
    }}
>
    <SwiperSlide>
        <div
            className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
            style={{
                backgroundImage: \`url(\${ c1 })\`,
            }}
        ></div>
    </SwiperSlide>
    <SwiperSlide>
        <div
            className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
            style={{
                backgroundImage: \`url(\${ c2 })\`,
            }}
        ></div>
    </SwiperSlide>
    <SwiperSlide>
        <div
            className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
            style={{
                backgroundImage: \`url(\${ c3 })\`,
            }}
        ></div>
    </SwiperSlide>
</Carousel>
    </>
  )
}
export default CarouselInterval
`;


export const carouselCrossfade = `
import Carousel from "@/components/ui/Carousel";
import { SwiperSlide } from "swiper/react";

// import images
import c1 from "@/assets/images/all-img/c1.png";
import c2 from "@/assets/images/all-img/c2.png";
import c3 from "@/assets/images/all-img/c3.png";

const CarouselCrossfade = () => {

  return (
    <>
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
                        backgroundImage: \`url(\${ c1 })\`,
                    }}
                ></div>
            </SwiperSlide>
            <SwiperSlide>
                <div
                    className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
                    style={{
                        backgroundImage: \`url(\${ c2 })\`,
                    }}
                ></div>
            </SwiperSlide>
            <SwiperSlide>
                <div
                    className="single-slide bg-no-repeat bg-cover bg-center rounded-lg min-h-[300px] "
                    style={{
                        backgroundImage: \`url(\${ c3 })\`,
                    }}
                ></div>
            </SwiperSlide>
        </Carousel>

    </>
  )
}
export default CarouselCrossfade
`;
