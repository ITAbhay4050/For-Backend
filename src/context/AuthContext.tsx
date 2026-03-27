import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, UserRole } from "@/types";
import { API_BASE } from "@/lib/apiConfig";

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");

    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (error) {
        console.error("Error parsing stored user:", error);
        localStorage.removeItem("user");
      }
    }

    setIsLoading(false);
  }, []);

  // -----------------------------
  // LOGIN
  // -----------------------------
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      console.log("🔐 Login API:", `${API_BASE}/login/`);

      const res = await fetch(`${API_BASE}/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("❌ Login API Error:", data);
        throw new Error(data.error || data.detail || "Invalid credentials");
      }

      console.log("✅ Login Success:", data);

      const loggedInUser: AuthUser = {
        id: String(data.employee_id ?? data.dealer_id ?? data.company_id),
        name: data.name,
        email,
        role: data.role as UserRole,
        token: data.token,
        companyId: data.company_id ? String(data.company_id) : undefined,
        dealerId: data.dealer_id ? String(data.dealer_id) : undefined,
        gstNumber: data.gst_no || undefined,
        company_name: data.company_name,
      };

      localStorage.setItem("user", JSON.stringify(loggedInUser));
      setUser(loggedInUser);

      return true;
    } catch (err) {
      console.error("❌ Login failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------
  // LOGOUT
  // -----------------------------
  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  // -----------------------------
  // DEALER REGISTER
  // -----------------------------
  const registerDealer = async (newUser: Partial<User>): Promise<boolean> => {
    setIsLoading(true);

    try {
      console.log("🏪 Dealer Register API:", `${API_BASE}/dealers/`);
      console.log("📦 Dealer Payload:", newUser);

      const res = await fetch(`${API_BASE}/dealers/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...newUser, isDirect: true }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("❌ Dealer Register Error:", data);
        throw new Error(
          data.error || data.detail || data.message || "Dealer registration failed"
        );
      }

      console.log("✅ Dealer Register Success:", data);
      return true;
    } catch (err) {
      console.error("❌ Dealer registration failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------
  // COMPANY REGISTER
  // -----------------------------
  const registerCompany = async (newUser: Partial<User>): Promise<boolean> => {
    setIsLoading(true);

    try {
      console.log("🏢 Company Register API:", `${API_BASE}/register/company/`);
      console.log("📦 Company Payload:", newUser);

      const res = await fetch(`${API_BASE}/register/company/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("❌ Company Register Error:", data);
        throw new Error(
          data.error || data.detail || data.message || "Company registration failed"
        );
      }

      console.log("✅ Company Register Success:", data);
      return true;
    } catch (err) {
      console.error("❌ Company registration failed:", err);
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

  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return ctx;
};