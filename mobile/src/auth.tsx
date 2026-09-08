import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAuthToken } from "./api";
import type { User } from "./types";

interface AuthValue {
  token: string | null;
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);
const KEY = "goldtrace.token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(KEY);
      if (saved) {
        setAuthToken(saved);
        setToken(saved);
        try {
          const me = await api.get<User>("/auth/me/");
          setUser(me.data);
        } catch {
          await AsyncStorage.removeItem(KEY);
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (username: string, password: string) => {
    const res = await api.post<{ access: string }>("/auth/token/", { username, password });
    const access = res.data.access;
    setAuthToken(access);
    await AsyncStorage.setItem(KEY, access);
    setToken(access);
    const me = await api.get<User>("/auth/me/");
    setUser(me.data);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
