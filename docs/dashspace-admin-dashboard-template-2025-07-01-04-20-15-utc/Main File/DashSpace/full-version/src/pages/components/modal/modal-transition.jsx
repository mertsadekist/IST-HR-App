import React, { useState } from "react";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import Textinput from "@/components/ui/Textinput";
import Select from "@/components/ui/Select";
import Radio from "@/components/ui/Radio";

import User1 from "@/assets/images/avatar/avatar.jpg";
import User2 from "@/assets/images/avatar/avatar-1.jpg";
import User3 from "@/assets/images/avatar/avatar-2.jpg";
import User4 from "@/assets/images/avatar/avatar-3.jpg";

const ModalTransition = () => {
  const [modal3, setModal3] = useState(false);
  const [modal4, setModal4] = useState(false);
  const [value, setValue] = useState("C");
  const handleChange = (e) => {
    setValue(e.target.value);
  };

  return (
    <div className=" space-xy">
      <button
        className="btn btn-primary light"
        onClick={() => setModal3(!modal3)}
        isBlur
      >
        Up
      </button>
      <button
        className="btn btn-primary light"
        onClick={() => setModal4(!modal4)}
        isBlur
      >
        Down
      </button>
      <Modal
        title="Active User"
        activeModal={modal3}
        onClose={() => setModal3(!modal3)}
        enterFrom="translate-y-5"
        leaveFrom="translate-y-0"
      >
        <div className=" text-gray-600 dark:text-gray-300 space-y-5">
          <Select label="alert type" />
          <Textinput label="Heading" placeholder="Heading.." />
          <div className="flex flex-wrap space-xy">
            <Radio
              label="simple"
              name="x2"
              value="D"
              checked={value === "D"}
              onChange={handleChange}
            />
            <Radio
              label="advanced"
              name="x2"
              value="C"
              checked={value === "C"}
              onChange={handleChange}
            />
          </div>
          <div className="md:flex justify-between md:space-y-0 space-y-4">
            <div className="-space-x-3 flex items-center">
              <Avatar src={User1} alt="avatar-one" />
              <Avatar src={User2} alt="avatar-one" />
              <Avatar src={User3} alt="avatar-one" />
              <Avatar src={User4} alt="avatar-one" />
              <div className="h-8 w-8 bg-indigo-500 text-white text-base  font-medium inline-flex   shrink-0 relative rounded-full ring-2  ring-white items-center justify-center">
                4+
              </div>
            </div>
            <button className="btn btn-primary"> send alert</button>
          </div>
        </div>
      </Modal>
      <Modal
        activeModal={modal4}
        onClose={() => setModal4(!modal4)}
        enterFrom="-translate-y-5"
        leaveFrom="translate-y-0"
      >
        <div className=" text-gray-600 dark:text-gray-300 space-y-5">
          <Select label="alert type" />
          <Textinput label="Heading" placeholder="Heading.." />
          <div className="flex flex-wrap space-xy">
            <Radio
              label="simple"
              name="x2"
              value="D"
              checked={value === "D"}
              onChange={handleChange}
            />
            <Radio
              label="advanced"
              name="x2"
              value="C"
              checked={value === "C"}
              onChange={handleChange}
            />
          </div>
          <div className="md:flex justify-between md:space-y-0 space-y-4">
            <div className="-space-x-3 flex items-center">
              <Avatar src={User1} alt="avatar-one" />
              <Avatar src={User2} alt="avatar-one" />
              <Avatar src={User3} alt="avatar-one" />
              <Avatar src={User4} alt="avatar-one" />
              <div className="h-8 w-8 bg-indigo-500 text-white text-base  font-medium inline-flex   shrink-0 relative rounded-full ring-2  ring-white items-center justify-center">
                4+
              </div>
            </div>
            <button className="btn btn-primary"> send alert</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ModalTransition;
