// export const formatTime = (time) => {
//   if (!time) return "";

//   const date = new Date(time);
//   return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
// };

export const formatTime = (time) => {
  if (!time) return "";

  const date = new Date(time);
  const formattedTime = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true, // Add this option to display AM/PM
  });

  return formattedTime;
};
