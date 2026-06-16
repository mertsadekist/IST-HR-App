import { createSlice } from '@reduxjs/toolkit';

// Persist the selected company so it survives reloads. A company MUST always be
// selected — there is no "ALL" mode.
const persisted = (() => {
  try { const v = localStorage.getItem('ist_company'); return v ? Number(v) : null; }
  catch { return null; }
})();

const entitySlice = createSlice({
  name: 'entity',
  initialState: {
    currentCompanyId: persisted, // resolved to a real company on load (see Sidebar)
  },
  reducers: {
    setCurrentCompany(state, { payload }) {
      state.currentCompanyId = payload;
      try {
        if (payload == null) localStorage.removeItem('ist_company');
        else localStorage.setItem('ist_company', String(payload));
      } catch { /* ignore storage errors */ }
    },
  },
});

export const { setCurrentCompany } = entitySlice.actions;
export default entitySlice.reducer;
