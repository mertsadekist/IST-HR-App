

import Card from "@/components/ui/code-snippet";
import BasicModal from "./basic-modal";
import { backdropBlur, basicModal, modalScale, modalTransition } from "./source-code";
import BackdropBlur from "./backdrop-blur";
import ModalTransition from "./modal-transition";
import ModalScale from "./modal-scale";

const ModalPage = () => {
  
  return (
    <div className=" space-y-5">
      <Card title="Basic Modal" code={basicModal}>
        <BasicModal />
      </Card>
      <Card title="Backdrop Blur" code={backdropBlur}>
        <BackdropBlur />
      </Card>
      <Card title="Modal Transition" code={modalTransition}>
        <ModalTransition />
      </Card>
      <Card title="Modal Scale" code={modalScale}>
        <ModalScale />
      </Card>
    </div>
  );
};

export default ModalPage;
