const tableServerConfig = (server) => {
  // Define your todo routes here
  server.get("/react_table", (schema, request) => {
    return schema.react_table.all();
  });

  server.get("/react_table/:id", (schema, request) => {
    let id = request.params.id;

    return schema.react_table.find(id);
  });

  server.post("/react_table", (schema, request) => {
    let attrs = JSON.parse(request.requestBody);

    return schema.react_table.create(attrs);
  });

  server.patch("/react_table/:id", (schema, request) => {
    let newAttrs = JSON.parse(request.requestBody);
    let id = request.params.id;
    let movie = schema.react_table.find(id);

    return movie.update(newAttrs);
  });

  server.delete("/react_table/:id", (schema, request) => {
    let id = request.params.id;

    return schema.react_table.find(id).destroy();
  });
};

export default tableServerConfig;
