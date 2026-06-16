import { apiSlice } from "../apiSlice";

export const chatApi = apiSlice.injectEndpoints({
  tagTypes: ["chats", "contacts"],
  endpoints: (builder) => ({
    getContacts: builder.query({
      query: (params) => ({
        url: `contacts?${new URLSearchParams(params).toString()}`,
        method: "GET",
      }),
      providesTags: ["contacts"],
    }),

    getChat: builder.query({
      query: (chatId) => `/chats/${chatId}`,
      providesTags: ["chats"],
    }),
    getProfileUser: builder.query({
      query: (chatId) => `/profileUsers`,
    }),
    sendMessage: builder.mutation({
      query: (message) => ({
        url: "/send-msg",
        method: "POST",
        body: { obj: message },
      }),
      invalidatesTags: ["chats", "contacts"],
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetChatQuery,
  useSendMessageMutation,
  useGetProfileUserQuery,
} = chatApi;
