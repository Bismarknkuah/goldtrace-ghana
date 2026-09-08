import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../types";

interface AuthState { access: string | null; refresh: string | null; user: User | null; }

const load = (): AuthState => {
  try {
    const raw = localStorage.getItem("goldtrace.auth");
    if (raw) return JSON.parse(raw) as AuthState;
  } catch { /* ignore */ }
  return { access: null, refresh: null, user: null };
};

const authSlice = createSlice({
  name: "auth",
  initialState: load(),
  reducers: {
    setTokens(state, action: PayloadAction<{ access: string; refresh: string }>) {
      state.access = action.payload.access;
      state.refresh = action.payload.refresh;
      localStorage.setItem("goldtrace.auth", JSON.stringify(state));
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      localStorage.setItem("goldtrace.auth", JSON.stringify(state));
    },
    logout(state) {
      state.access = null; state.refresh = null; state.user = null;
      localStorage.removeItem("goldtrace.auth");
    },
  },
});

export const { setTokens, setUser, logout } = authSlice.actions;
export default authSlice.reducer;
