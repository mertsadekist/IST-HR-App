export const menuItems = [
  {
    isHeadr: true,
    title: "menu",
  },

  {
    title: "Blank Page",
    icon: "ph:house",
    isHide: true,
    link: "dashboard",
  },
];

export const topMenu = [
  {
    title: "Blank Page",
    icon: "ph:house-line",
    link: "dashboard",
  },
];

import User1 from "@/assets/images/avatar/avatar-1.jpg";
import User2 from "@/assets/images/avatar/avatar-2.jpg";
import User3 from "@/assets/images/avatar/avatar-3.jpg";
import User4 from "@/assets/images/avatar/avatar-4.jpg";
export const notifications = [
  {
    title:
      "Your Account has been created  <span class='font-medium'>successfully done</span>",

    icon: "ph:seal-check-light",
    status: "green",
    link: "#",
  },
  {
    title:
      "You upload your first product <span class='font-medium'>successfully done</span>",

    icon: "ph:cube-light",
    status: "blue",
    link: "#",
  },
  {
    title: "<span class='font-medium'>Thank you !</span> you made your first",
    icon: "ph:shopping-cart-light",
    status: "yellow",
    link: "#",
  },
  {
    title: "<span class='font-medium'>Broklan Simons </span> New are New admin",
    icon: "ph:user-circle-plus-light",
    status: "cyan",
    link: "#",
  },
  {
    title:
      "Your are update to Deshboard <span class='font-medium'>Pro Version</span>",
    status: "red",
    icon: "ph:lightning-light",
    link: "#",
  },
];

export const message = [
  {
    title: "Ronald Richards",
    desc: "Hello there, here is  a Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil, fugiat.",
    active: true,
    hasnotifaction: true,
    notification_count: 1,
    image: User1,
    link: "#",
  },
  {
    title: "Wade Warren",
    desc: "Hello there, here is  a Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil, fugiat.",
    active: false,
    hasnotifaction: true,
    image: User2,
    link: "#",
  },
  {
    title: "Albert Flores",
    desc: "Hello there, here is  a Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil, fugiat.",
    active: false,
    hasnotifaction: true,
    notification_count: 8,
    image: User3,
    link: "#",
  },
  {
    title: "Savannah Nguyen",
    desc: "Hello there, here is  a Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil, fugiat.",
    active: true,
    hasnotifaction: false,
    image: User4,
    link: "#",
  },
  {
    title: "Esther Howard",
    desc: "Hello there, here is  a Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil, fugiat.",
    active: false,
    hasnotifaction: true,
    image: User2,
    link: "#",
  },
  {
    title: "Ralph Edwards",
    desc: "Hello there, here is  a Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil, fugiat.",
    active: false,
    hasnotifaction: false,
    notification_count: 8,
    image: User3,
    link: "#",
  },
  {
    title: "Cody Fisher",
    desc: "Hello there, here is  a Lorem ipsum dolor sit amet consectetur adipisicing elit. Nihil, fugiat.",
    active: true,
    hasnotifaction: false,
    image: User4,
    link: "#",
  },
];

export const colors = {
  primary: "#3b82f6",
  secondary: "#d946ef",
  danger: "#ef4444",
  black: "#000",
  warning: "#eab308",
  info: "#06b6d4",
  light: "#425466",
  success: "#22c55e",
  "gray-f7": "#F7F8FC",
  dark: "#1E293B",
  "dark-gray": "#0F172A",
  gray: "#68768A",
  gray2: "#EEF1F9",
  "dark-light": "#CBD5E1",
};

export const hexToRGB = (hex, alpha) => {
  var r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);

  if (alpha) {
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  } else {
    return "rgb(" + r + ", " + g + ", " + b + ")";
  }
};

export const topFilterLists = [
  {
    name: "Inbox",
    value: "all",
    icon: "uil:image-v",
  },
  {
    name: "Starred",
    value: "fav",
    icon: "heroicons:star",
  },
  {
    name: "Sent",
    value: "sent",
    icon: "heroicons-outline:paper-airplane",
  },

  {
    name: "Drafts",
    value: "drafts",
    icon: "heroicons-outline:pencil-alt",
  },
  {
    name: "Spam",
    value: "spam",
    icon: "heroicons:information-circle",
  },
  {
    name: "Trash",
    value: "trash",
    icon: "heroicons:trash",
  },
];

export const bottomFilterLists = [
  {
    name: "personal",
    value: "personal",
    icon: "heroicons:chevron-double-right",
  },
  {
    name: "Social",
    value: "social",
    icon: "heroicons:chevron-double-right",
  },
  {
    name: "Promotions",
    value: "promotions",
    icon: "heroicons:chevron-double-right",
  },
  {
    name: "Business",
    value: "business",
    icon: "heroicons:chevron-double-right",
  },
];

import meetsImage1 from "@/assets/images/svg/sk.svg";
import meetsImage2 from "@/assets/images/svg/path.svg";
import meetsImage3 from "@/assets/images/svg/dc.svg";
import meetsImage4 from "@/assets/images/svg/sk.svg";

export const meets = [
  {
    img: meetsImage1,
    title: "Meeting with client",
    date: "01 Nov 2021",
    meet: "Zoom meeting",
  },
  {
    img: meetsImage2,
    title: "Design meeting (team)",
    date: "01 Nov 2021",
    meet: "Skyp meeting",
  },
  {
    img: meetsImage3,
    title: "Background research",
    date: "01 Nov 2021",
    meet: "Google meeting",
  },
  {
    img: meetsImage4,
    title: "Meeting with client",
    date: "01 Nov 2021",
    meet: "Zoom meeting",
  },
];
import file1Img from "@/assets/images/icon/file-1.svg";
import file2Img from "@/assets/images/icon/pdf-1.svg";
import file3Img from "@/assets/images/icon/zip-1.svg";
import file4Img from "@/assets/images/icon/pdf-2.svg";
import file5Img from "@/assets/images/icon/scr-1.svg";

export const files = [
  {
    img: file1Img,
    title: "Dashboard.fig",
    date: "06 June 2021 / 155MB",
  },
  {
    img: file2Img,
    title: "Ecommerce.pdf",
    date: "06 June 2021 / 155MB",
  },
  {
    img: file3Img,
    title: "Job portal_app.zip",
    date: "06 June 2021 / 155MB",
  },
  {
    img: file4Img,
    title: "Ecommerce.pdf",
    date: "06 June 2021 / 155MB",
  },
  {
    img: file5Img,
    title: "Screenshot.jpg",
    date: "06 June 2021 / 155MB",
  },
];

export const filterOptions = [
  { value: "all", label: "All" },
  { value: "favorite", label: "Favorite" },
  { value: "completed", label: "Completed" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "update", label: "Update" },
  { value: "team", label: "Team" },
];
