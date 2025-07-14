import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, UserRole } from "@/types";

/* ------------------------------------------------------------------ */
/* Helper types                                                        */
/* ------------------------------------------------------------------ */
export type AuthUser = User & {
  /** DRF token for Authorization header */
  token: string;
  /** Present only when user_type === "dealer" */
  dealerId?: string;
  /** Present only when user_type === "company" */
  companyId?: string;
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

/* ------------------------------------------------------------------ */
/* React context                                                       */
/* ------------------------------------------------------------------ */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* Use Vite env var if provided, fallback to localhost */
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

/* ------------------------------------------------------------------ */
/* Provider component                                                  */
/* ------------------------------------------------------------------ */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /* ---------- bootstrap from localStorage ---------- */
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    setIsLoading(false);
  }, []);

  /* ---------- login ---------- */
 const login = async (email: string, password: string) => {
  setIsLoading(true);
  try {
    // First try the unified login endpoint
    let res = await fetch(`${API_BASE}/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    // If unified login fails with 404, try employee-specific endpoint
    if (res.status === 404) {
      res = await fetch(`${API_BASE}/employee-login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Invalid credentials");
    }

    const data = await res.json();
    
    const loggedInUser: AuthUser = {
      id: String(data.employee_id || data.dealer_id || data.company_id),
      name: data.name,
      email,
      role: data.role as UserRole,
      token: data.token,
      companyId: data.company_id ? String(data.company_id) : undefined,
      dealerId: data.dealer_id ? String(data.dealer_id) : undefined,
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
  /* ---------- logout ---------- */
  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  /* ---------- register dealer ---------- */
  const registerDealer = async (newUser: Partial<User>) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/register/dealer/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
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

  /* ---------- register company ---------- */
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

/* ------------------------------------------------------------------ */
/* Consumer hook                                                      */
/* ------------------------------------------------------------------ */
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};