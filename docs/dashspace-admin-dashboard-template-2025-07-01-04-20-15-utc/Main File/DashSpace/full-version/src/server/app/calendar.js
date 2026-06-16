const calendarServerConfig = (server) => {
  server.get("/categories", () => {
    return [
      {
        label: "Business",
        value: "business",
        activeClass: "border-indigo-500 bg-indigo-500",
        className: " group-hover:border-indigo-500",
      },
      {
        label: "Personal",
        value: "personal",

        activeClass: "border-green-500 bg-green-500",
        className: " group-hover:border-green-500",
      },
      {
        label: "Holiday",
        value: "holiday",
        activeClass: "border-red-500 bg-red-500",
        className: " group-hover:border-red-500",
      },
      {
        label: "Family",
        value: "family",
        activeClass: "border-cyan-500 bg-cyan-500",
        className: " group-hover:border-cyan-500",
      },
      {
        label: "Meeting",
        value: "meeting",
        activeClass: "border-yellow-500 bg-yellow-500",
        className: " group-hover:border-yellow-500",
      },
      {
        label: "Etc",
        value: "etc",
        activeClass: "border-cyan-500 bg-cyan-500",
        className: " group-hover:border-cyan-500",
      },
    ];
  });

  server.get("/calendarEvents", (schema) => {
    let calendarEvents = schema.calendarEvents.all();
    return calendarEvents;
  });

  server.post("/calendarEvents", (schema, request) => {
    const attrs = JSON.parse(request.requestBody);
    return schema.calendarEvents.create(attrs);
  });
  server.put("/calendarEvents/:id", (schema, request) => {
    const id = request.params.id;
    const attrs = JSON.parse(request.requestBody);
    const calendarEvent = schema.calendarEvents.find(id);
    return calendarEvent.update(attrs);
  });
  server.delete("/calendarEvents/:id", (schema, request) => {
    let id = request.params.id;

    return schema.calendarEvents.find(id).destroy();
  });
};

export default calendarServerConfig;
