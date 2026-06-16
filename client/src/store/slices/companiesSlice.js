import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as companiesApi from '@api/companiesApi';

export const fetchCompanies = createAsyncThunk(
  'companies/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await companiesApi.getCompanies();
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load companies');
    }
  }
);

const companiesSlice = createSlice({
  name: 'companies',
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanies.fulfilled, (state, { payload }) => {
        state.items = payload;
        state.loading = false;
      })
      .addCase(fetchCompanies.rejected, (state, { payload }) => {
        state.error = payload;
        state.loading = false;
      });
  },
});

export default companiesSlice.reducer;
