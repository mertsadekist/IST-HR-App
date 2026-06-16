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