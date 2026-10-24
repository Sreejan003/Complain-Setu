import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile } from "../services/types.js";
import { api } from "../services/api.js";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  demoAccounts: any[];
  login: (email: string, password?: string) => Promise<void>;
  switchUserRole: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [demoAccounts, setDemoAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function initAuth() {
      try {
        const accounts = await api.getDemoAccounts();
        setDemoAccounts(accounts);

        const token = localStorage.getItem("aicte_token");
        if (token) {
          const profile = await api.getCurrentUser();
          setUser(profile);
        } else if (accounts.length > 0) {
          // Default auto-login as Dr. Rajeshwar Sharma (Administrator) for smooth demo experience
          const defaultAdmin = accounts[0];
          const res = await api.login(defaultAdmin.email, "Aicte@2026");
          localStorage.setItem("aicte_token", res.token);
          setUser(res.user);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  const login = async (email: string, password?: string) => {
    setLoading(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem("aicte_token", res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const switchUserRole = async (email: string) => {
    setLoading(true);
    try {
      const res = await api.login(email, "Aicte@2026");
      localStorage.setItem("aicte_token", res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("aicte_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, demoAccounts, login, switchUserRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
