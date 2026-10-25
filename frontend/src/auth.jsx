import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("eventure:logout", onLogout);
    return () => window.removeEventListener("eventure:logout", onLogout);
  }, []);

  const finish = (r) => {
    setToken(r.token);
    setUser(r.user);
  };
  const login = async (email, password) => finish(await api.post("/auth/login", { email, password }));
  const register = async (data) => finish(await api.post("/auth/register", data));
  const logout = () => {
    setToken(null);
    setUser(null);
  };
  const refresh = useCallback(async () => {
    const r = await api.get("/auth/me");
    setUser(r.user);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
