import { apiSlice } from "../apiSlice";

export const todoApi = apiSlice.injectEndpoints({
  tagTypes: ["todos"],
  endpoints: (builder) => ({
    getTodos: builder.query({
      query: (params) => ({
        url: `todos?${new URLSearchParams(params).toString()}`,
        method: "GET",
      }),
      providesTags: ["todos"],
    }),
    addTodo: builder.mutation({
      query: (todo) => ({
        url: "/todos",
        method: "POST",
        body: todo,
      }),

      invalidatesTags: ["todos"],
    }),
    editTodo: builder.mutation({
      query: ({ id, todo }) => ({
        url: `/todos/${id}`,
        method: "PUT",
        body: { id, ...todo },
      }),
      invalidatesTags: ["todos"],
    }),
    deleteTodo: builder.mutation({
      query: (id) => ({
        url: `/todos/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["todos"],
    }),
  }),
});

export const {
  useGetTodosQuery,
  useAddTodoMutation,
  useEditTodoMutation,
  useDeleteTodoMutation,
} = todoApi;
