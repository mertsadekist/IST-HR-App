import React, { useState } from "react";
import Card from "@/components/ui/code-snippet";
import Switch from "@/components/ui/Switch";
import BasicSwitch from "./basic-switch";
import { basicSwitch } from "./source-code";

const SwitchPage = () => {
  const [checked, setChecked] = useState(true);
  const [checked3, setChecked3] = useState(false);
  const [checked4, setChecked4] = useState(true);
  const [checked5, setChecked5] = useState(true);
  const [checked6, setChecked6] = useState(true);
  const [checked7, setChecked7] = useState(true);
  const [checked8, setChecked8] = useState(true);
  const [checked9, setChecked9] = useState(true);
  const [checked10, setChecked10] = useState(true);

  return (
    <div className="space-y-5">
      <Card title="Basic Switch" code={basicSwitch}>
        <BasicSwitch />
      </Card>

      <Card title="Outline Switch">
        <div className="flex flex-wrap space-xy">
          <Switch
            label="Default & primary"
            outline
            activeClass="border-gray-500"
            value={checked}
            onChange={() => setChecked(!checked)}
          />

          <Switch
            label="secondary"
            outline
            activeClass="border-fuchsia-500"
            activeThumb="bg-fuchsia-500"
            value={checked6}
            onChange={() => setChecked6(!checked6)}
          />
          <Switch
            label="success"
            outline
            activeClass="border-green-500"
            activeThumb="bg-green-500"
            value={checked7}
            onChange={() => setChecked7(!checked7)}
          />
          <Switch
            label="danger"
            outline
            activeClass="border-red-500"
            activeThumb="bg-red-500"
            value={checked8}
            onChange={() => setChecked8(!checked8)}
          />
          <Switch
            label="warning"
            outline
            activeClass="border-yellow-500"
            activeThumb="bg-yellow-500"
            value={checked9}
            onChange={() => setChecked9(!checked9)}
          />
          <Switch
            label="info"
            outline
            activeClass="border-cyan-500"
            activeThumb="bg-cyan-500"
            value={checked10}
            onChange={() => setChecked10(!checked10)}
          />
        </div>
      </Card>

      <Card title="Switch With Text & Icon  ">
        <div className="flex flex-wrap space-xy">
          <Switch
            label="primary"
            activeClass="bg-indigo-500"
            value={checked5}
            onChange={() => setChecked5(!checked5)}
            badge
          />
          <Switch
            label="secondary"
            activeClass="bg-fuchsia-500"
            value={checked6}
            onChange={() => setChecked6(!checked6)}
            badge
          />
          <Switch
            label="success"
            activeClass="bg-green-500"
            value={checked7}
            onChange={() => setChecked7(!checked7)}
            badge
          />
          <Switch
            label="danger"
            activeClass="bg-red-500"
            value={checked8}
            onChange={() => setChecked8(!checked8)}
            badge
          />
          <Switch
            label="warning"
            activeClass="bg-yellow-500"
            value={checked9}
            onChange={() => setChecked9(!checked9)}
            badge
          />
          <Switch
            label="info"
            activeClass="bg-cyan-500"
            value={checked10}
            onChange={() => setChecked10(!checked10)}
            badge
          />
          <Switch
            label="primary"
            activeClass="bg-indigo-500"
            value={checked5}
            onChange={() => setChecked5(!checked5)}
            badge
            prevIcon="ph:speaker-high"
            nextIcon="ph:speaker-slash"
          />
          <Switch
            label="secondary"
            activeClass="bg-fuchsia-500"
            value={checked6}
            onChange={() => setChecked6(!checked6)}
            badge
            prevIcon="ph:check"
            nextIcon="ph:x"
          />
          <Switch
            label="success"
            activeClass="bg-green-500"
            value={checked7}
            onChange={() => setChecked7(!checked7)}
            badge
            prevIcon="ph:sun-horizon"
            nextIcon="ph:moon-stars"
          />
          <Switch
            label="danger"
            activeClass="bg-red-500"
            value={checked8}
            onChange={() => setChecked8(!checked8)}
            badge
            prevIcon="ph:lock-simple"
            nextIcon="ph:lock-simple-open"
          />
          <Switch
            label="warning"
            activeClass="bg-yellow-500"
            value={checked9}
            onChange={() => setChecked9(!checked9)}
            badge
            prevIcon="ph:shield-check"
            nextIcon="ph:bandaids"
          />
          <Switch
            label="info"
            activeClass="bg-cyan-500"
            value={checked10}
            onChange={() => setChecked10(!checked10)}
            badge
            prevIcon="ph:bandaids"
            nextIcon="ph:phone-slash"
          />
        </div>
      </Card>

      <Card title="Disabled Switch ">
        <div className="flex space-x-4 rtl:space-x-reverse">
          <Switch
            label="Default"
            disabled
            value={checked3}
            onChange={() => setChecked3(!checked3)}
          />
          <Switch
            label="Primary"
            disabled
            value={checked4}
            activeClass="bg-indigo-500"
            onChange={() => setChecked4(!checked4)}
          />
          <Switch
            label="Primary Outline"
            outline
            disabled
            value={checked4}
            activeClass="border-indigo-500"
            activeThumb="bg-indigo-500"
            onChange={() => setChecked4(!checked4)}
          />
          <Switch
            label="warning"
            activeClass="bg-yellow-400"
            value={checked9}
            onChange={() => setChecked9(!checked9)}
            badge
            disabled
            prevIcon="ph:shield-check"
            nextIcon="ph:bandaids"
          />
        </div>
      </Card>
    </div>
  );
};

export default SwitchPage;
