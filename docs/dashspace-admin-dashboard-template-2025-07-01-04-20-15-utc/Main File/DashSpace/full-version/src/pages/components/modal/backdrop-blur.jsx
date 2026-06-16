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