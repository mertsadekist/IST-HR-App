const boardServerConfig = (server) => {
  server.get("/boards", (schema, request) => {
    const boards = schema.db.boards.map((board) => {
      const tasks = schema.db.tasks.where({ boardId: board.id });
      return { ...board, tasks };
    });
    return boards;
  });

  server.post("/boards", (schema, request) => {
    const attrs = JSON.parse(request.requestBody);
    const board = schema.db.boards.insert(attrs);

    return board;
  });
  server.put("/boards/:boardId", (schema, request) => {
    const boardId = request.params.boardId;
    const board = schema.db.boards.find(boardId);

    if (!board) {
      return new Response(404, {}, { message: "Board not found" });
    }

    const attrs = JSON.parse(request.requestBody);
    const updatedBoard = schema.db.boards.update(boardId, attrs);

    return updatedBoard;
  });

  server.post("/boards/:boardId/tasks", (schema, request) => {
    const boardId = request.params.boardId;
    const board = schema.db.boards.find(boardId);

    if (!board) {
      return new Response(404, {}, { message: "Board not found" });
    }

    const attrs = JSON.parse(request.requestBody);
    const task = schema.db.tasks.insert({ ...attrs, boardId: boardId });

    return task;
  });
  server.put("/boards/:boardId/tasks/:taskId", (schema, request) => {
    const boardId = request.params.boardId;
    const taskId = request.params.taskId;

    const board = schema.db.boards.find(boardId);

    if (!board) {
      return new Response(404, {}, { message: "Board not found" });
    }

    const task = schema.db.tasks.find(taskId);

    if (!task) {
      return new Response(404, {}, { message: "Task not found" });
    }

    const attrs = JSON.parse(request.requestBody);
    const updatedTask = schema.db.tasks.update(taskId, attrs);

    return updatedTask;
  });
  server.delete("/boards/:boardId", (schema, request) => {
    const boardId = request.params.boardId;
    const board = schema.db.boards.find(boardId);

    if (!board) {
      return new Response(404, {}, { message: "Board not found" });
    }

    schema.db.boards.remove(board);

    return new Response(200, {}, { message: "Board deleted successfully" });
  });
  server.delete("/boards/:boardId/tasks/:taskId", (schema, request) => {
    const boardId = request.params.boardId;
    const taskId = request.params.taskId;

    const board = schema.db.boards.find(boardId);

    if (!board) {
      return new Response(404, {}, { message: "Board not found" });
    }

    const task = schema.db.tasks.find(taskId);

    if (!task) {
      return new Response(404, {}, { message: "Task not found" });
    }

    schema.db.tasks.remove(task);

    return new Response(200, {}, { message: "Task deleted successfully" });
  });
};

export default boardServerConfig;
