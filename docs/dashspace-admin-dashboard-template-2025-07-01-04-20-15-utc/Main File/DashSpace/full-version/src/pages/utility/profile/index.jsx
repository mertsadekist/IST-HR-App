import React, { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/Icon";
import Card from "@/components/ui/Card";
import Fileinput from "@/components/ui/Fileinput";
import Button from "@/components/ui/Button";
import Textinput from "@/components/ui/Textinput";
import Textarea from "@/components/ui/Textarea";
import Avatar from "@/components/ui/Avatar";
// import images
import { motion, AnimatePresence } from "framer-motion";
import ProfileImage from "@/assets/images/avatar/avatar.jpg";
const ProfilePage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };
  const tabs = [
    { icon: "ph:user-circle", label: "Account" },
    { icon: "ph:bell-ringing", label: "Notifications" },
    { icon: "ph:lock-key", label: "Security" },
    { icon: "ph:codesandbox-logo", label: "App" },
    { icon: "ph:database", label: "Privacy & Data" },
  ];
  const [selectedTab, setSelectedTab] = useState(tabs[0]);
  console.log(tabs[0]);
  return (
    <div>
      <div className="space-y-5 profile-page">
        <div className="grid grid-cols-12 gap-6">
          <div className="lg:col-span-4 col-span-12">
            <Card
              title={
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div className=" shrink-0">
                    <Avatar
                      src={
                        selectedFile
                          ? URL.createObjectURL(selectedFile)
                          : ProfileImage
                      }
                      className="h-14 w-14"
                      imgClass=""
                      alt={selectedFile?.name}
                    />
                  </div>
                  <div className="text-gray-700 dark:text-white text-sm font-semibold  ">
                    <span className=" truncate w-full block">Faruk Ahamed</span>
                    <span className="block font-light text-xs   capitalize">
                      supper admin
                    </span>
                  </div>
                </div>
              }
            >
              <ul className=" space-y-2">
                {tabs.map((item) => (
                  <li
                    key={item.label}
                    className={`
                      ${
                        item.label === selectedTab.label
                          ? "bg-indigo-500 text-white"
                          : ""
                      }
                        flex space-x-3 rtl:space-x-reverse px-3 py-2 rounded-md hover:bg-indigo-500/10 hover:text-indigo-500 capitalize  cursor-pointer`}
                    onClick={() => setSelectedTab(item)}
                  >
                    <div className="flex-none text-xl ">
                      <Icon icon={item.icon} />
                    </div>
                    <div className="flex-1 text-sm">{item.label}</div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="lg:col-span-8 col-span-12 space-y-5">
            {selectedTab && (
              <Card title={selectedTab.label}>
                <motion.div
                  key={selectedTab.label}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className=" space-y-5">
                    <Fileinput
                      selectedFile={selectedFile}
                      onChange={handleFileChange}
                    >
                      <Button
                        div
                        icon="ph:upload"
                        text="Choose File"
                        iconClass="text-xl"
                        className="btn-primary light btn-sm"
                      />
                    </Fileinput>
                    <Textinput
                      label="Display name "
                      placeholder="Display name "
                      id="d_name"
                    />
                    <Textinput
                      label="Email"
                      type="email"
                      placeholder="email"
                      id="email"
                    />
                    <Textarea label="bio" placeholder="Bio" id="bio" />
                    <div className="text-right">
                      <Button div text="Update" className="btn-primary" />
                    </div>
                  </div>
                </motion.div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
