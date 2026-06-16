import clsx from "clsx";
const ExternalDraggingevent = ({ event }) => {
  const { title, id, tag } = event;
  return (
    <div
      title={title}
      data={id}
      className={clsx(
        " fc-event  px-4 py-1.5 rounded text-sm flex space-x-2 items-center rtl:space-x-reverse shadow-sm  cursor-move ",
        {
          "bg-indigo-500/10 text-indigo-500": tag === "business",
          "bg-yellow-500/10 text-yellow-500": tag === "meeting",
          "bg-red-500/10 text-red-500": tag === "holiday",
          "bg-cyan-500/10 text-cyan-500": tag === "etc",
        }
      )}
    >
      <span
        className={clsx("h-2 w-2 rounded-full", {
          "bg-indigo-500": tag === "business",
          "bg-yellow-500": tag === "meeting",
          "bg-red-500": tag === "holiday",
          "bg-cyan-500": tag === "etc",
        })}
      ></span>
      <span> {title}</span>
    </div>
  );
};

export default ExternalDraggingevent;
