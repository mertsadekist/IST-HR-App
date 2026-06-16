const todoServerConfig = (server) => {
  // Define your todo routes here
  server.get("/todos", (schema, request) => {
    const {
      searchTerm,
      assignee,
      sortBy,
      favorite,
      completed,
      category,
      filter,
      page,
      limit,
    } = request.queryParams;

    let todos = schema.todos.all();

    todos = todos.filter((todo) => {
      // Filter based on searchTerm
      if (searchTerm) {
        return todo.title.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });

    if (assignee) {
      todos = todos.filter((todo) =>
        todo.assignee.toLowerCase().includes(assignee.toLowerCase())
      );
    }

    // Apply sorting
    if (sortBy === "asc") {
      todos = todos.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "desc") {
      todos = todos.sort((a, b) => b.title.localeCompare(a.title));
    }
    // Apply filter based on selected filter value
    if (filter === "all") {
      // Return all todos
      todos = todos;
    } else if (filter === "favorite") {
      // Filter by favorite todos
      todos = todos.filter((todo) => todo.favorite);
    } else if (filter === "completed") {
      // Filter by completed todos
      todos = todos.filter((todo) => todo.completed);
    } else {
      // Filter by category value
      todos = todos.filter((todo) =>
        todo.category.some((cat) => cat.value === filter)
      );
    }

    return todos;
  });

  server.get("/todos/:id", (schema, request) => {
    let id = request.params.id;

    return schema.todos.find(id);
  });

  server.post("/todos", (schema, request) => {
    let attrs = JSON.parse(request.requestBody);

    return schema.todos.create(attrs);
  });

  server.put("/todos/:id", (schema, request) => {
    const id = request.params.id;
    const attrs = JSON.parse(request.requestBody);
    const todo = schema.todos.find(id);
    return todo.update(attrs);
  });

  server.delete("/todos/:id", (schema, request) => {
    let id = request.params.id;

    return schema.todos.find(id).destroy();
  });
};

export default todoServerConfig;
