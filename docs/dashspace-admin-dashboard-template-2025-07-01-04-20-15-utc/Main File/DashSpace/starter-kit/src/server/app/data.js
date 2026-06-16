import { faker } from "@faker-js/faker";
import avatar1 from "@/assets/images/avatar/avatar-1.jpg";
const previousDay = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
const dayBeforePreviousDay = new Date(
  new Date().getTime() - 24 * 60 * 60 * 1000 * 2
);

export const profileUser = {
  id: 11,
  avatar: avatar1,
  fullName: "John Doe",
  role: "admin",
  about:
    "Dessert chocolate cake lemon drops jujubes. Biscuit cupcake ice cream bear claw brownie brownie marshmallow.",
  status: "online",
  settings: {
    isTwoStepAuthVerificationEnabled: true,
    isNotificationsOn: false,
  },
};

export const contacts = [
  {
    id: 1,
    fullName: "Felecia Rower",
    role: "Frontend Developer",
    about:
      "Cake pie jelly jelly beans. Marzipan lemon drops halvah cake. Pudding cookie lemon drops icing",

    avatar: faker.image.avatarLegacy(),
    status: "online",
  },
  {
    id: 2,
    fullName: "Adalberto Granzin",
    role: "UI/UX Designer",
    about:
      "Toffee caramels jelly-o tart gummi bears cake I love ice cream lollipop. Sweet liquorice croissant candy danish dessert icing. Cake macaroon gingerbread toffee sweet.",
    avatar: faker.image.avatarLegacy(),
    status: "online",
  },
  {
    id: 3,
    fullName: "Joaquina Weisenborn",
    role: "Town planner",
    about:
      "Soufflé soufflé caramels sweet roll. Jelly lollipop sesame snaps bear claw jelly beans sugar plum sugar plum.",
    avatar: faker.image.avatarLegacy(),
    status: "busy",
  },
  {
    id: 4,
    fullName: "Verla Morgano",
    role: "Data scientist",
    about:
      "Chupa chups candy canes chocolate bar marshmallow liquorice muffin. Lemon drops oat cake tart liquorice tart cookie. Jelly-o cookie tootsie roll halvah.",
    avatar: faker.image.avatarLegacy(),
    status: "online",
  },
  {
    id: 5,
    fullName: "Margot Henschke",
    role: "Dietitian",
    about:
      "Cake pie jelly jelly beans. Marzipan lemon drops halvah cake. Pudding cookie lemon drops icing",
    avatar: faker.image.avatarLegacy(),
    status: "busy",
  },
  {
    id: 6,
    fullName: "Sal Piggee",
    role: "Marketing executive",
    about:
      "Toffee caramels jelly-o tart gummi bears cake I love ice cream lollipop. Sweet liquorice croissant candy danish dessert icing. Cake macaroon gingerbread toffee sweet.",
    avatar: faker.image.avatarLegacy(),
    status: "online",
  },
  {
    id: 7,
    fullName: "Miguel Guelff",
    role: "Special educational needs teacher",
    about:
      "Biscuit powder oat cake donut brownie ice cream I love soufflé. I love tootsie roll I love powder tootsie roll.",
    avatar: faker.image.avatarLegacy(),
    status: "online",
  },
  {
    id: 8,
    fullName: "Mauro Elenbaas",
    role: "Advertising copywriter",
    about:
      "Bear claw ice cream lollipop gingerbread carrot cake. Brownie gummi bears chocolate muffin croissant jelly I love marzipan wafer.",
    avatar: faker.image.avatarLegacy(),
    status: "away",
  },
  {
    id: 9,
    fullName: "Bridgett Omohundro",
    role: "Designer, television/film set",
    about:
      "Gummies gummi bears I love candy icing apple pie I love marzipan bear claw. I love tart biscuit I love candy canes pudding chupa chups liquorice croissant.",
    avatar: faker.image.avatarLegacy(),
    status: "offline",
  },
  {
    id: 10,
    fullName: "Zenia Jacobs",
    role: "Building surveyor",
    about:
      "Cake pie jelly jelly beans. Marzipan lemon drops halvah cake. Pudding cookie lemon drops icing",
    avatar: faker.image.avatarLegacy(),
    status: "away",
  },
];

export const chats = [
  {
    id: 1,
    userId: 1,
    unseenMsgs: 0,
    chat: [
      {
        message: "Hi",
        time: "Mon Dec 10 2018 07:45:00 GMT+0000 (GMT)",
        senderId: 11,
      },
      {
        message: "Hello. How can I help You?",
        time: "Mon Dec 11 2018 07:45:15 GMT+0000 (GMT)",
        senderId: 2,
      },
      {
        message: "Can I get details of my last transaction I made last month?",
        time: "Mon Dec 11 2018 07:46:10 GMT+0000 (GMT)",
        senderId: 11,
      },
      {
        message: "We need to check if we can provide you such information.",
        time: "Mon Dec 11 2018 07:45:15 GMT+0000 (GMT)",
        senderId: 2,
      },
      {
        message: "I will inform you as I get update on this.",
        time: "Mon Dec 11 2018 07:46:15 GMT+0000 (GMT)",
        senderId: 2,
      },
      {
        message: "If it takes long you can mail me at my mail address.",
        time: dayBeforePreviousDay,
        senderId: 11,
      },
    ],
  },
  {
    id: 2,
    userId: 2,
    unseenMsgs: 1,
    chat: [
      {
        message: "How can we help? We're here for you!",
        time: "Mon Dec 10 2018 07:45:00 GMT+0000 (GMT)",
        senderId: 11,
      },
      {
        message:
          "Hey John, I am looking for the best admin template. Could you please help me to find it out?",
        time: "Mon Dec 10 2018 07:45:23 GMT+0000 (GMT)",
        senderId: 1,
      },
      {
        message: "It should be Bootstrap 5 compatible.",
        time: "Mon Dec 10 2018 07:45:55 GMT+0000 (GMT)",
        senderId: 1,
      },
      {
        message: "Absolutely!",
        time: "Mon Dec 10 2018 07:46:00 GMT+0000 (GMT)",
        senderId: 11,
      },
      {
        message: "Modern admin is the responsive bootstrap 5 admin template.!",
        time: "Mon Dec 10 2018 07:46:05 GMT+0000 (GMT)",
        senderId: 11,
      },
      {
        message: "Looks clean and fresh UI.",
        time: "Mon Dec 10 2018 07:46:23 GMT+0000 (GMT)",
        senderId: 1,
      },
      {
        message: "It's perfect for my next project.",
        time: "Mon Dec 10 2018 07:46:33 GMT+0000 (GMT)",
        senderId: 1,
      },
      {
        message: "How can I purchase it?",
        time: "Mon Dec 10 2018 07:46:43 GMT+0000 (GMT)",
        senderId: 1,
      },
      {
        message: "Thanks, from ThemeForest.",
        time: "Mon Dec 10 2018 07:46:53 GMT+0000 (GMT)",
        senderId: 11,
      },
      {
        message: "I will purchase it for sure. 👍",
        time: previousDay,
        senderId: 1,
      },
    ],
  },
];

const date = new Date();
const prevDay = new Date().getDate() - 1;
const nextDay = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);

// prettier-ignore
const nextMonth = date.getMonth() === 11 ? new Date(date.getFullYear() + 1, 0, 1) : new Date(date.getFullYear(), date.getMonth() + 1, 1)
// prettier-ignore
const prevMonth = date.getMonth() === 11 ? new Date(date.getFullYear() - 1, 0, 1) : new Date(date.getFullYear(), date.getMonth() - 1, 1)
export const calendarEvents = [
  {
    title: "All Day Event",
    start: date,
    end: nextDay,
    allDay: false,
    //className: "warning",
    extendedProps: {
      calendar: "business",
    },
  },
  {
    title: "Meeting With Client",
    start: new Date(date.getFullYear(), date.getMonth() + 1, -11),
    end: new Date(date.getFullYear(), date.getMonth() + 1, -10),
    allDay: true,
    //className: "success",
    extendedProps: {
      calendar: "personal",
    },
  },
  {
    title: "Lunch",
    allDay: true,
    start: new Date(date.getFullYear(), date.getMonth() + 1, -9),
    end: new Date(date.getFullYear(), date.getMonth() + 1, -7),
    // className: "info",
    extendedProps: {
      calendar: "family",
    },
  },
  {
    title: "Birthday Party",
    start: new Date(date.getFullYear(), date.getMonth() + 1, -11),
    end: new Date(date.getFullYear(), date.getMonth() + 1, -10),
    allDay: true,
    //className: "primary",
    extendedProps: {
      calendar: "meeting",
    },
  },
  {
    title: "Birthday Party",

    start: new Date(date.getFullYear(), date.getMonth() + 1, -13),
    end: new Date(date.getFullYear(), date.getMonth() + 1, -12),
    allDay: true,
    // className: "danger",
    extendedProps: {
      calendar: "holiday",
    },
  },
  {
    title: "Monthly Meeting",
    start: nextMonth,
    end: nextMonth,
    allDay: true,
    //className: "primary",
    extendedProps: {
      calendar: "business",
    },
  },
];
