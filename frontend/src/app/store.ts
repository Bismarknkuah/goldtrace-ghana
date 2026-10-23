import { configureStore } from "@reduxjs/toolkit";
import { api } from "../services/api";
import auth from "../features/authSlice";

export const store = configureStore({
  reducer: { auth, [api.reducerPath]: api.reducer },
  middleware: (gdm) => gdm().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
