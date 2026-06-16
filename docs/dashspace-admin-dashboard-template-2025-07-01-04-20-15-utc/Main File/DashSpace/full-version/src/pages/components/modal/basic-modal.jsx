import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import Icon from "@/components/ui/Icon";
const BasicModal = () => {
  return (
    <Dialog>
      <DialogTrigger>
        <button className="btn btn-primary light ">Basic Modal</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
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

            <DialogClose asChild>
              <button className="btn btn-success ">close</button>
            </DialogClose>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default BasicModal;
