import React from 'react';
import Card from "../../components/ui/Card";
import CarouselBasic from './carousel-basic';
import { carouselBasic, carouselCrossfade, carouselInterval } from './source-code';
import CarouselInterval from './carousel-interval';
import CarouselCrossfade from './carousel-crossfade';
const CarouselPage = () => {
    return (
        <div className="grid xl:grid-cols-2 grid-cols-1 gap-5">
            <Card title="Carousel Basic" code={carouselBasic}>
                <CarouselBasic />
            </Card>
            <Card title="Carousel Interval" code={carouselInterval}>
                <CarouselInterval />
            </Card>
            <Card title="Crossfade" code={carouselCrossfade}>
                <CarouselCrossfade />
            </Card>
        </div>
    );
};

export default CarouselPage;