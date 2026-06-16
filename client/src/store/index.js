import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import entityReducer from './slices/entitySlice';
import companiesReducer from './slices/companiesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    entity: entityReducer,
    companies: companiesReducer,
  },
});
