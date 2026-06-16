import { createServer, Model, Factory, hasMany, belongsTo } from "miragejs";
import {
  TodoFactory,
  ContactFactory,
  ChatFactory,
  profileFactory,
  MessageFactory,
} from "./app/factory";
import { profileUser, contacts, chats, calendarEvents } from "./app/data";
import todoServerConfig from "./app/todoServer";
import boardServerConfig from "./app/boardServer";
import authServerConfig from "./auth/authServer";
import contactServerConfig from "./app/chatServer";
import calendarServerConfig from "./app/calendar";
import { faker } from "@faker-js/faker";
const previousDay = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
const dayBeforePreviousDay = new Date(
  new Date().getTime() - 24 * 60 * 60 * 1000 * 2
);

createServer({
  models: {
    todo: Model,
    user: Model,
    board: Model.extend({
      tasks: hasMany(),
    }),
    task: Model.extend({
      board: belongsTo(),
    }),
    profileUser: Model,
    contact: Model,
    chat: Model,
    calendarEvent: Model,
  },
  factories: {
    todo: TodoFactory,
  },

  seeds(server) {
    const backlog = server.create("board", {
      title: "Backlog",
      id: faker.string.uuid(),
    });
    const inProgress = server.create("board", {
      title: "In Progress",
      id: faker.string.uuid(),
    });
    const done = server.create("board", {
      title: "Done",
      id: faker.string.uuid(),
    });

    server.create("task", {
      title:
        " Meeting with UI/UX Team to manage our upcoming projects &amp; task.",
      date: faker.date.anytime(),
      priority: "high",
      assign: [
        {
          image: faker.image.avatar(),
          label: faker.person.firstName(),
          value: faker.internet.userName(),
        },
        {
          image: faker.image.avatar(),
          label: faker.person.firstName(),
          value: faker.internet.userName(),
        },
        {
          image: faker.image.avatar(),
          label: faker.person.firstName(),
          value: faker.internet.userName(),
        },
      ],
      startDate: faker.date.between({
        from: "2023-01-01T00:00:00.000Z",
        to: "2023-03-01T00:00:00.000Z",
      }),
      endDate: faker.date.between({
        from: "2023-01-01T00:00:00.000Z",
        to: "2023-03-01T00:00:00.000Z",
      }),
      boardId: backlog.id,
    });

    server.create("task", {
      title: " Meeting with  Team to manage Employee",
      date: faker.date.anytime(),
      priority: "medium",
      assign: [
        {
          image: faker.image.avatar(),
          label: faker.person.firstName(),
          value: faker.internet.userName(),
        },
        {
          image: faker.image.avatar(),
          label: faker.person.firstName(),
          value: faker.internet.userName(),
        },
      ],
      startDate: faker.date.between({
        from: "2023-01-01T00:00:00.000Z",
        to: "2023-03-01T00:00:00.000Z",
      }),
      endDate: faker.date.between({
        from: "2023-01-01T00:00:00.000Z",
        to: "2023-03-01T00:00:00.000Z",
      }),
      boardId: inProgress.id,
    });
    server.create("task", {
      title: "Meet with CTO",
      date: faker.date.anytime(),
      priority: "low",
      assign: [
        {
          image: faker.image.avatar(),
          label: faker.person.firstName(),
          value: faker.internet.userName(),
        },
        {
          image: faker.image.avatar(),
          label: faker.person.firstName(),
          value: faker.internet.userName(),
        },
        {
          image: faker.image.avatar(),
          label: faker.person.firstName(),
          value: faker.internet.userName(),
        },
      ],
      startDate: faker.date.between({
        from: "2023-01-01T00:00:00.000Z",
        to: "2023-03-01T00:00:00.000Z",
      }),
      endDate: faker.date.between({
        from: "2023-01-01T00:00:00.000Z",
        to: "2023-03-01T00:00:00.000Z",
      }),
      boardId: done.id,
    });
    server.createList("todo", 20);

    server.create("user", {
      email: "DashSpace@gmail.com",
      password: "DashSpace",
    });
    server.create("profileUser", { ...profileUser });
    contacts.forEach((contact) => {
      server.create("contact", {
        id: contact.id,
        fullName: contact.fullName,
        role: contact.role,
        about: contact.about,
        avatar: contact.avatar,
        status: contact.status,
      });
    });

    chats.forEach((chat) => {
      server.create("chat", {
        id: chat.id,
        userId: chat.userId,
        unseenMsgs: chat.unseenMsgs,
        chat: chat.chat,
      });
    });
    calendarEvents.forEach((element) => {
      server.create("calendarEvent", {
        id: faker.string.uuid(),
        title: element.title,
        start: element.start,
        end: element.end,
        allDay: element.allDay,
        //className: "warning",
        extendedProps: {
          calendar: element.extendedProps.calendar,
        },
      });
    });
  },
  routes() {
    //this.namespace = "api";

    todoServerConfig(this);
    boardServerConfig(this);
    authServerConfig(this);
    contactServerConfig(this);
    calendarServerConfig(this);
    this.timing = 500;
    //this.passthrough();
  },
});
