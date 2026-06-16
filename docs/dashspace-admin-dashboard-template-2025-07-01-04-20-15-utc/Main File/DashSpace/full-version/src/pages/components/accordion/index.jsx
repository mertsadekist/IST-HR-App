import React from 'react';
import Card from "@/components/ui/code-snippet";
import SingleAccordion from './SingleAccordion';
import { singleAccordion } from './source-code';

const AccordionPage = () => {

    return (
        <div className='space-y-5'>
            <Card title="Accordions" code={singleAccordion}>
                <SingleAccordion />
            </Card>
        </div>

    );
};

export default AccordionPage;