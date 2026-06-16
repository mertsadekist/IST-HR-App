import React, { useState, useEffect, useRef } from "react";
import {
  useGetContactsQuery,
  useGetChatQuery,
  useSendMessageMutation,
  useGetProfileUserQuery,
} from "@/store/api/app/chatApiSlice";
import Card from "@/components/ui/Card";
import LoadingIcon from "@/components/LoadingIcon";
import Avatar from "@/components/ui/Avatar";
import ContactList from "./contact-list";
import MessageList from "./message-list";
import SendMessage from "./send-message";
import SimpleBar from "simplebar-react";
import clsx from "clsx";
import BlankMessage from "./blank-message";
import ChatHead from "./chat-head";
const ChatPage = () => {
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: contacts = [], isLoading: contactsLoading } =
    useGetContactsQuery(searchTerm);
  const { data: chatData, isLoading: chatLoading } =
    useGetChatQuery(selectedChatId);
  const { data: profileData, isLoading: profileLoading } =
    useGetProfileUserQuery();
  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();

  const openChat = (chatId) => {
    setSelectedChatId(chatId);
  };

  const handleSendMessage = (message) => {
    if (!selectedChatId || !message) return;

    const newMessage = {
      message: message,
      contact: { id: selectedChatId },
    };
    sendMessage(newMessage);
  };
  const chatHeightRef = useRef(null);

  useEffect(() => {
    if (chatHeightRef.current) {
      chatHeightRef.current.scrollTo({
        top: chatHeightRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [handleSendMessage, contacts]);

  const chats = chatData?.chat?.chat || [];

  return (
    <div className="flex chat-height  shadow-md bg-white">
      <div className="flex-none lg:w-[260px] md:w-[200px] w-20 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md rounded-tr-none rounded-br-none ">
        <SimpleBar className="  h-full ">
          {contactsLoading ? (
            <LoadingIcon />
          ) : (
            <>
              <div className="sticky top-0 z-[1]  py-3 px-4 rounded-tl-md  bg-white/70 border-gray-200 dark:border-gray-700 border-b  backdrop-blur-sm dark:bg-gray-800/50">
                <div className="flex space-x-3 rtl:space-x-reverse">
                  <Avatar
                    src={profileData?.profileUser?.avatar}
                    dot
                    className="h-10 w-10"
                    dotClass={
                      profileData?.profileUser?.status === "online"
                        ? "bg-indigo-500"
                        : "bg-gray-500"
                    }
                  />
                  <div className="flex-1 md:block hidden">
                    <input
                      type="text"
                      className="text-control py-2 rounded-full"
                      placeholder="Search.."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              {contacts?.contacts?.map((contact, i) => (
                <ContactList
                  key={`contact-list-${i}`}
                  openChat={openChat}
                  contact={contact}
                  selectedChatId={selectedChatId}
                />
              ))}
            </>
          )}
        </SimpleBar>
      </div>
      <div
        className={clsx("flex-1", {
          "flex flex-col items-center justify-center": !selectedChatId,
        })}
      >
        {selectedChatId ? (
          <>
            <ChatHead contact={chatData?.contact} />
            <div className="parent-height">
              <ul
                className="msgs overflow-y-auto msg-height pt-6 space-y-6 "
                ref={chatHeightRef}
              >
                {chatLoading ? (
                  <LoadingIcon />
                ) : (
                  <>
                    {chats?.map((message, i) => (
                      <MessageList
                        key={`message-list-${i}`}
                        message={message}
                        contact={chatData?.contact}
                        profile={profileData}
                      />
                    ))}
                    {isSending && (
                      <LoadingIcon className="text-indigo-500 h-10 ml-auto mr-10 mb-6" />
                    )}
                  </>
                )}
              </ul>
            </div>

            {!chatLoading && (
              <SendMessage handleSendMessage={handleSendMessage} />
            )}
          </>
        ) : (
          <BlankMessage />
        )}
      </div>
    </div>
  );
};

export default ChatPage;
