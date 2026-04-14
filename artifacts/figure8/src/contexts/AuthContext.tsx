import { createContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, setAuthTokenGetter, getGetMeQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { getToken, setToken, clearToken } from "../lib/auth";

setAuthTokenGetter(getToken);

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { data, isError, isLoading: isQueryLoading } = useGetMe({
    query: {
      enabled: !!getToken(),
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (!getToken()) {
      setIsLoading(false);
      return;
    }

    if (isQueryLoading) return;

    if (data && !isError) {
      setUser(data);
    } else if (isError) {
      clearToken();
      setUser(null);
    }
    setIsLoading(false);
  }, [data, isError, isQueryLoading]);

  const login = (token: string, userData: User) => {
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
