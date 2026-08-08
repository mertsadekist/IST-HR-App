import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as authApi from '@api/authApi';
import * as usersApi from '@api/usersApi';

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(username, password);
      localStorage.setItem('ist_token', data.token);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Login failed');
    }
  }
);

export const verifyToken = createAsyncThunk(
  'auth/verify',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await authApi.me();
      return data;
    } catch {
      localStorage.removeItem('ist_token');
      return rejectWithValue('Invalid token');
    }
  }
);

/**
 * Start a "login as" session. The returned token replaces the admin's own, so
 * every request from here on is made as the target user — which is the point.
 * Getting back out goes through the server (stopImpersonation), not through a
 * stashed copy of the old token, so the way back cannot outlive the admin's
 * account being disabled.
 */
export const impersonateUser = createAsyncThunk(
  'auth/impersonate',
  async (userId, { rejectWithValue }) => {
    try {
      const { data } = await usersApi.impersonate(userId);
      localStorage.setItem('ist_token', data.token);
      return { user: data.user, impersonatedBy: data.impersonated_by };
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Could not sign in as this user');
    }
  }
);

export const stopImpersonation = createAsyncThunk(
  'auth/stopImpersonation',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await authApi.stopImpersonation();
      localStorage.setItem('ist_token', data.token);
      return data.user;
    } catch (err) {
      // The way back is gone (expired, or the admin account was disabled), so
      // the only safe state is signed out rather than stuck as someone else.
      localStorage.removeItem('ist_token');
      return rejectWithValue(err.response?.data?.error || 'Could not return to your account');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    loading: !!localStorage.getItem('ist_token'),       // For ProtectedRoute initial token check
    loginLoading: false, // For Login button spinner
    // Set only while operating someone else's account; drives the banner.
    impersonatedBy: null,
    error: null,
  },
  reducers: {
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.impersonatedBy = null;
      localStorage.removeItem('ist_token');
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loginLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.isAuthenticated = true;
        state.loginLoading = false;
        state.loading = false;
        state.impersonatedBy = null;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, { payload }) => {
        state.error = payload;
        state.loginLoading = false;
      })
      // Verify — /me reports the borrowed session, so a reload keeps the banner
      .addCase(verifyToken.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.isAuthenticated = true;
        state.loading = false;
        state.impersonatedBy = payload.impersonated_by || null;
      })
      .addCase(verifyToken.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.impersonatedBy = null;
      })
      // Impersonation
      .addCase(impersonateUser.fulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.isAuthenticated = true;
        state.impersonatedBy = payload.impersonatedBy;
      })
      .addCase(stopImpersonation.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.isAuthenticated = true;
        state.impersonatedBy = null;
      })
      .addCase(stopImpersonation.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.impersonatedBy = null;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
