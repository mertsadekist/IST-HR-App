const chatServerConfig = (server) => {
  server.get("/profileUsers", (schema) => {
    const profileUser = schema.profileUsers.first();
    return profileUser;
  });

  // server.get("/contacts", (schema) => {
  //   const chats = schema.chats.all();
  //   const chatsContacts = chats.models.map((chat) => {
  //     const contact = schema.contacts.find(chat.userId);
  //     contact.chat = {
  //       id: chat.id,
  //       unseenMsgs: chat.unseenMsgs,
  //       lastMessage: chat.chat[chat.chat.length - 1],
  //     };
  //     return contact;
  //   });
  //   const profileUserData = schema.profileUsers.first();
  //   return {
  //     chatsContacts,
  //     contacts: schema.contacts.all(),
  //     profileUser: profileUserData,
  //   };
  // });
  // server.get("/contacts", (schema, request) => {
  //   const { searchTerm } = request.queryParams;

  //   const chats = schema.chats.all();
  //   const chatsContacts = chats.models.map((chat) => {
  //     const contact = schema.contacts.find(chat.userId);
  //     contact.chat = {
  //       id: chat.id,
  //       unseenMsgs: chat.unseenMsgs,
  //       lastMessage: chat.chat[chat.chat.length - 1],
  //     };
  //     return contact;
  //   });

  //   let contacts = schema.contacts.all();

  //   if (searchTerm) {
  //     contacts = contacts.filter((contact) => {
  //       return contact.fullName
  //         .toLowerCase()
  //         .includes(searchTerm.toLowerCase());
  //     });
  //   }

  //   const profileUserData = schema.profileUsers.first();

  //   return {
  //     chatsContacts,
  //     contacts,
  //     profileUser: profileUserData,
  //   };
  // });

  server.get("/contacts", (schema, request) => {
    const { searchTerm } = request.queryParams;

    const contacts = schema.contacts.all();

    if (searchTerm) {
      const filteredContacts = contacts.filter((contact) => {
        return contact.fullName
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      });

      return {
        contacts: filteredContacts,
      };
    }

    const chats = schema.chats.all();
    const chatsContacts = contacts.models.map((contact) => {
      const chat = chats.models.find((chat) => chat.userId === contact.id);
      const lastMessage = chat ? chat.chat[chat.chat.length - 1] : null;
      const lastMessageTime = lastMessage ? lastMessage.time : null;

      return {
        ...contact.attrs,
        chat: {
          id: chat ? chat.id : null,
          unseenMsgs: chat ? chat.unseenMsgs : null,
          lastMessage: lastMessage ? lastMessage.message : null,
          lastMessageTime: lastMessageTime
            ? new Date(lastMessageTime).toISOString()
            : null,
        },
      };
    });

    return {
      contacts: chatsContacts,
    };
  });

  server.get("/chats/:id", (schema, request) => {
    const userId = parseInt(request.params.id, 10);
    const chat = schema.chats.find(userId);
    if (chat) {
      chat.update({ unseenMsgs: 0 }); // Update unseenMsgs property to 0
    }
    const contact = schema.contacts.find(userId);
    if (contact.chat) {
      contact.chat.update({ unseenMsgs: 0 }); // Update unseenMsgs property to 0
    }
    return { chat, contact };
  });

  server.post("/send-msg", (schema, request) => {
    const { obj } = JSON.parse(request.requestBody);

    let activeChat = schema.chats.findBy({ userId: obj.contact.id });

    const newMessageData = {
      message: obj.message,
      time: new Date(),
      senderId: 11,
    };

    let isNewChat = false;
    if (!activeChat) {
      isNewChat = true;
      activeChat = schema.chats.create({
        id: obj.contact.id,
        userId: obj.contact.id,
        unseenMsgs: 0,
        chat: [newMessageData],
      });
    } else {
      activeChat.chat.push(newMessageData);
    }

    schema.chats.all().models.sort((a, b) => b.id - a.id);

    return {
      chat: activeChat,
      contact: obj.contact,
      newMessageData,
      id: obj.contact.id,
    };
  });
};

export default chatServerConfig;
