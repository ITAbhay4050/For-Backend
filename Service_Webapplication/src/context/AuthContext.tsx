import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, UserRole } from "@/types";

export type AuthUser = User & {
  token: string;
  dealerId?: string;
  companyId?: string;
  gstNumber?: string;
};

interface AuthContextType {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  registerDealer: (u: Partial<User>) => Promise<boolean>;
  registerCompany: (u: Partial<User>) => Promise<boolean>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE = import.meta.env.VITE_API_BASE;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    setIsLoading(false);
  }, []);

  // AuthContext.tsx (updated snippet)

const login = async (email: string, password: string) => {
  setIsLoading(true);
  try {
    const res = await fetch(`${API_BASE}/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error || "Invalid credentials");
    }

    const data = await res.json();

    const loggedInUser: AuthUser = {
      id: String(data.employee_id ?? data.dealer_id ?? data.company_id),
      name: data.name,
      email,
      role: data.role as UserRole,
      token: data.token,
      companyId: data.company_id ? String(data.company_id) : undefined,
      dealerId: data.dealer_id ? String(data.dealer_id) : undefined,
      gstNumber: data.gst_no || undefined,
      company_name: data.company_name, // ✅ ADD THIS LINE
    };

    localStorage.setItem("user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return true;
  } catch (err) {
    console.error("Login failed:", err);
    return false;
  } finally {
    setIsLoading(false);
  }
};
  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  const registerDealer = async (newUser: Partial<User>) => {
    setIsLoading(true);
    try {
      // Add isDirect: true if you want to bypass OTP (adjust as needed)
      const res = await fetch(`${API_BASE}/dealers/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newUser, isDirect: true }), // ⬅️ use /dealers/
      });
      if (!res.ok) throw new Error("Registration failed");
      return true;
    } catch (err) {
      console.error("Dealer registration failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const registerCompany = async (newUser: Partial<User>) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/register/company/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) throw new Error("Registration failed");
      return true;
    } catch (err) {
      console.error("Company registration failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        logout,
        registerDealer,
        registerCompany,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};