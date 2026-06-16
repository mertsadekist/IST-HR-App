import { apiSlice } from "../apiSlice";

export const boardApi = apiSlice.injectEndpoints({
  tagTypes: ["boards"],
  endpoints: (builder) => ({
    getBoards: builder.query({
      query: () => ({
        url: `boards`,
        method: "GET",
      }),
      // keepUnusedDataFor: 1,
      providesTags: ["boards"],
    }),
    createBoard: builder.mutation({
      query: (board) => ({
        url: "/boards",
        method: "POST",
        body: board,
      }),

      invalidatesTags: ["boards"],
    }),
    editBoard: builder.mutation({
      query: ({ boardId, board }) => ({
        url: `/boards/${boardId}`,
        method: "PUT",
        body: { boardId, ...board },
      }),
      invalidatesTags: ["boards"],
    }),
    createTask: builder.mutation({
      query: ({ boardId, ...task }) => ({
        url: `/boards/${boardId}/tasks`,
        method: "POST",
        body: task,
      }),
      invalidatesTags: ["boards"],
    }),
    editTask: builder.mutation({
      query: ({ boardId, taskId, task }) => ({
        url: `/boards/${boardId}/tasks/${taskId}`,
        method: "PUT",
        body: { taskId, ...task },
      }),
      invalidatesTags: ["boards"],
    }),
    deleteBoard: builder.mutation({
      query: (id) => ({
        url: `/boards/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["boards"],
    }),
    deleteTask: builder.mutation({
      query: ({ boardId, taskId }) => ({
        url: `/boards/${boardId}/tasks/${taskId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["boards"],
    }),
  }),
});

export const {
  useGetBoardsQuery,
  useCreateBoardMutation,
  useCreateTaskMutation,
  useDeleteBoardMutation,
  useDeleteTaskMutation,
  useEditBoardMutation,
  useEditTaskMutation,
} = boardApi;
