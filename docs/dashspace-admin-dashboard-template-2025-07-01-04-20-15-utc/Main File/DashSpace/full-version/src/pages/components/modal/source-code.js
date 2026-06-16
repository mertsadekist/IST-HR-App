export const basicModal = `
import React, { useState } from 'react';
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
const BasicModal = () => {
    const [modal1, setModal1] = useState(false);
    return (
        <div className=" space-xy">
            <button
                className="btn btn-primary light"
                onClick={() => setModal1(!modal1)}
            >
                basic modal
            </button>
            <Modal activeModal={modal1} onClose={() => setModal1(!modal1)}>
                <div className=" text-center text-gray-600 dark:text-gray-300 space-y-4">
                    <Icon
                        icon="ph:check-circle"
                        className=" text-6xl text-green-500 mx-auto"
                    />
                    <div className=" text-xl font-medium ">Success Message</div>
                    <div className="  text-sm">
                        Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                        Consequuntur dignissimos soluta totam?
                    </div>
                    <button
                        className="btn btn-success "
                        onClick={() => setModal1(!modal1)}
                    >
                        close
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default BasicModal;
`;

export const backdropBlur = `
import React, { useState } from 'react';
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
const BackdropBlur = () => {
    const [modal2, setModal2] = useState(false);
    return (
        <div className="space-xy">
            <button
                className="btn btn-primary light"
                onClick={() => setModal2(!modal2)}
                isBlur
            >
                Backdrop Blur
            </button>
            <Modal activeModal={modal2} onClose={() => setModal2(!modal2)} isBlur>
                <div className=" text-center text-gray-600 dark:text-gray-300 space-y-4">
                    <Icon
                        icon="ph:check-circle"
                        className=" text-6xl text-green-500 mx-auto"
                    />
                    <div className=" text-xl font-medium ">Success Message</div>
                    <div className="  text-sm">
                        Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                        Consequuntur dignissimos soluta totam?
                    </div>
                    <button
                        className="btn btn-success "
                        onClick={() => setModal2(!modal2)}
                    >
                        close
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default BackdropBlur;
`;

export const modalTransition = `
import React, { useState } from 'react';
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
        <>
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
        </>
    );
};

export default ModalTransition;
`;

export const modalScale = `
import React, { useState } from 'react';

import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";

const ModalScale = () => {
    const [modal5, setModal5] = useState(false);
    const [modal6, setModal6] = useState(false);
    return (
        <div className="space-xy">
            <button
                className="btn btn-primary light"
                onClick={() => setModal5(!modal5)}
                isBlur
            >
                Scale top
            </button>
            <button
                className="btn btn-primary light"
                onClick={() => setModal6(!modal6)}
                isBlur
            >
                Scale Down
            </button>
            <Modal
                activeModal={modal5}
                onClose={() => setModal5(!modal5)}
                enterFrom="scale-90 translate-y-5"
                leaveFrom="scale-100 translate-y-0"
            >
                <div className=" text-center text-gray-600 dark:text-gray-300 space-y-4">
                    <Icon
                        icon="ph:check-circle"
                        className=" text-6xl text-green-500 mx-auto"
                    />
                    <div className=" text-xl font-medium ">Success Message</div>
                    <div className="  text-sm">
                        Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                        Consequuntur dignissimos soluta totam?
                    </div>
                    <button
                        className="btn btn-success "
                        onClick={() => setModal5(!modal5)}
                    >
                        close
                    </button>
                </div>
            </Modal>
            <Modal
                activeModal={modal6}
                onClose={() => setModal6(!modal6)}
                enterFrom="scale-90 -translate-y-5"
                leaveFrom="scale-100 translate-y-0"
            >
                <div className=" text-center text-gray-600 dark:text-gray-300 space-y-4">
                    <Icon
                        icon="ph:check-circle"
                        className=" text-6xl text-green-500 mx-auto"
                    />
                    <div className=" text-xl font-medium ">Success Message</div>
                    <div className="  text-sm">
                        Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                        Consequuntur dignissimos soluta totam?
                    </div>
                    <button
                        className="btn btn-success "
                        onClick={() => setModal6(!modal6)}
                    >
                        close
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default ModalScale;
`;
