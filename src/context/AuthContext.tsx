import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { User, UserRole } from "@/types";

// Mock data for demo purposes
const MOCK_USERS = [
  {
    id: "1",
    name: "System Admin",
    email: "admin@system.com",
    role: UserRole.APPLICATION_ADMIN,
  },
  {
    id: "2",
    name: "Company Admin",
    email: "admin@company.com",
    role: UserRole.COMPANY_ADMIN,
    companyId: "1",
  },
  {
    id: "3",
    name: "Company Employee",
    email: "employee@company.com",
    role: UserRole.COMPANY_EMPLOYEE,
    companyId: "1",
  },
  {
    id: "4",
    name: "Dealer Admin",
    email: "admin@dealer.com",
    role: UserRole.DEALER_ADMIN,
    dealerId: "1",
    companyId: "1",
  },
  {
    id: "5",
    name: "Dealer Employee",
    email: "employee@dealer.com",
    role: UserRole.DEALER_EMPLOYEE,
    dealerId: "1",
    companyId: "1",
  },
];

// ✅ Add setUser to the context type
type AuthContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (user: Partial<User>) => Promise<boolean>;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const foundUser = MOCK_USERS.find(u => u.email === email);

      if (foundUser) {
        setUser(foundUser);
        localStorage.setItem("user", JSON.stringify(foundUser));
        setIsLoading(false);
        return true;
      }

      setIsLoading(false);
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const register = async (newUser: Partial<User>): Promise<boolean> => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Registration failed:", error);
      setIsLoading(false);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser, // ✅ include setter here
        login,
        logout,
        register,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
