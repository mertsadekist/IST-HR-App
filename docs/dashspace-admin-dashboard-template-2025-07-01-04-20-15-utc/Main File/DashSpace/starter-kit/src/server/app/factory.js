import { faker } from "@faker-js/faker";
import { Factory } from "miragejs";

let usedIds = [];

export const TodoFactory = Factory.extend({
  title: () => faker.lorem.sentence(),
  completed: () => faker.datatype.boolean(),
  favorite: () => faker.datatype.boolean(),
  assign: (i) => {
    const numAssign = faker.number.int({ min: 1, max: 2 });
    const assignObjects = [];

    for (let j = 0; j < numAssign; j++) {
      assignObjects.push({
        image: faker.image.avatar(),
        label: faker.person.firstName(),
        value: faker.internet.userName(),
      });
    }

    return assignObjects;
  },
  category: (i) => {
    const categories = [
      {
        value: "team",
        label: "team",
      },
      {
        value: "low",
        label: "low",
      },
      {
        value: "high",
        label: "high",
      },
      {
        value: "update",
        label: "update",
      },
      {
        value: "medium",
        label: "medium",
      },
    ];
    const numCategories = faker.number.int({
      min: 1,
      max: 3,
    });
    const shuffledCategories = faker.helpers.shuffle(categories);
    return shuffledCategories.slice(0, numCategories);
  },
});

export const ContactFactory = Factory.extend({
  fullName() {
    return faker.person.firstName();
  },
  role() {
    return faker.person.firstName();
  },
  about() {
    return faker.lorem.sentence();
  },
  avatar() {
    return faker.image.avatar();
  },
  status() {
    return faker.datatype.boolean() ? "online" : "offline";
  },
});

export const ChatFactory = Factory.extend({
  userId() {
    return 1;
  },
  unseenMsgs: 0,
  chat() {
    const chatCount = faker.number.int({ min: 1, max: 10 });
    const senderIds = [faker.number.int({ min: 1, max: 10 }), 11];

    return Array.from({ length: chatCount }).map(() => ({
      message: faker.lorem.sentence(),
      time: faker.date.recent(),
      senderId: senderIds[Math.floor(Math.random() * senderIds.length)],
    }));
    // return [
    //   {
    //     message: "Hi",
    //     time: "Mon Dec 10 2018 07:45:00 GMT+0000 (GMT)",
    //     senderId: 11,
    //   },
    //   {
    //     message: "Hello. How can I help you?",
    //     time: "Mon Dec 11 2018 07:45:15 GMT+0000 (GMT)",
    //     senderId: 2,
    //   },
    //   {
    //     message: "Can I get details of my last transaction I made last month?",
    //     time: "Mon Dec 11 2018 07:46:10 GMT+0000 (GMT)",
    //     senderId: 11,
    //   },
    //   {
    //     message:
    //       "We need to check if we can provide you with such information.",
    //     time: "Mon Dec 11 2018 07:45:15 GMT+0000 (GMT)",
    //     senderId: 2,
    //   },
    //   {
    //     message: "I will inform you as I get an update on this.",
    //     time: "Mon Dec 11 2018 07:46:15 GMT+0000 (GMT)",
    //     senderId: 2,
    //   },
    //   {
    //     message: "If it takes long, you can mail me at my email address.",
    //     time: null,
    //     senderId: 11,
    //   },
    // ];
  },
});

export const MessageFactory = Factory.extend({
  chatId() {
    return faker.number.int({ min: 1, max: 10 });
  },
  message() {
    return faker.lorem.sentence();
  },
  time() {
    return faker.date.recent();
  },
  senderId() {
    return faker.number.int({ min: 1, max: 10 });
  },
});

export const profileFactory = Factory.extend({
  id: 11,
  avatar: faker.image.avatar(),
  fullName: "John Doe",
  role: "admin",
  about:
    "Dessert chocolate cake lemon drops jujubes. Biscuit cupcake ice cream bear claw brownie brownie marshmallow.",
  status: "online",
  settings: {
    isTwoStepAuthVerificationEnabled: true,
    isNotificationsOn: false,
  },
});
