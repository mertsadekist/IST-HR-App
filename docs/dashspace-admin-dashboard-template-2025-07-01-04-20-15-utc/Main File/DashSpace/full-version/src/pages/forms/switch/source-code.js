export const basicSwitch =`
import React, { useState } from 'react';
import Switch from "@/components/ui/Switch";
const BasicSwitch = () => {
    const [checked, setChecked] = useState(true);
    const [checked6, setChecked6] = useState(true);
    const [checked7, setChecked7] = useState(true);
    const [checked8, setChecked8] = useState(true);
    const [checked9, setChecked9] = useState(true);
    const [checked10, setChecked10] = useState(true);
    return (
        <div className="flex flex-wrap space-xy">
            <Switch
                label="Default & Primary"
                value={checked}
                onChange={() => setChecked(!checked)}
            />

            <Switch
                label="secondary"
                activeClass="bg-fuchsia-500"
                value={checked6}
                onChange={() => setChecked6(!checked6)}
            />
            <Switch
                label="success"
                activeClass="bg-green-500"
                value={checked7}
                onChange={() => setChecked7(!checked7)}
            />
            <Switch
                label="danger"
                activeClass="bg-red-500"
                value={checked8}
                onChange={() => setChecked8(!checked8)}
            />
            <Switch
                label="warning"
                activeClass="bg-yellow-500"
                value={checked9}
                onChange={() => setChecked9(!checked9)}
            />
            <Switch
                label="info"
                activeClass="bg-cyan-500"
                value={checked10}
                onChange={() => setChecked10(!checked10)}
            />
        </div>
    );
};
export default BasicSwitch;
`