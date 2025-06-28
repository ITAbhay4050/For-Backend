import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

const Login = () => {
  // ----------------------- Local state -----------------------
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ----------------------- Global auth -----------------------
  const { setUser } = useAuth();      // Auth context se setter
  const navigate = useNavigate();     // React‑router ke liye

  // -----------------------------------------------------------
  // Handle form submit
  // -----------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Validation Error",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Login Failed",
          description: data.message || "Invalid email or password",
          variant: "destructive",
        });
        return;
      }

      // 🔑 Map backend response → local role string
      const role =
        data.user_type === "dealer"
          ? "DEALER_ADMIN"
          : data.user_type === "company"
          ? "COMPANY_ADMIN"
          : "UNKNOWN";

      // 🔑 Save user in context so puri app ko mile
      setUser({
        id: data.dealer_id || data.company_id, // unique ID
        name: data.name,                       // display name
        email: email,
        role: role,                            // enum string
        companyId: data.company_id || null,
        dealerId: data.dealer_id || null,
      });

      // (Optional) localStorage me bhi store kar sakte ho
      localStorage.setItem("userType", data.user_type);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("authToken", data.token);

      toast({
        title: "Login Successful",
        description: `Welcome, ${role.replace("_", " ")}`,
      });

      navigate("/dashboard");
    } catch (err) {
      toast({
        title: "Error",
        description: "Server error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // -----------------------------------------------------------
  // Demo credential autofill
  // -----------------------------------------------------------
  const fillCredentials = (role: string) => {
    switch (role) {
      case "admin":
        setEmail("admin@system.com");
        setPassword("password");
        break;
      case "company_admin":
        setEmail("admin@company.com");
        setPassword("password");
        break;
      case "company_employee":
        setEmail("employee@company.com");
        setPassword("password");
        break;
      case "dealer_admin":
        setEmail("admin@dealer.com");
        setPassword("password");
        break;
      case "dealer_employee":
        setEmail("employee@dealer.com");
        setPassword("password");
        break;
    }
  };

  // -----------------------------------------------------------
  // UI / JSX
  // -----------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-gray-900 to-slate-900 relative">
      {/* Decorative grainy overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iNCIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>

      <div className="w-full max-w-md px-4 relative z-10">
        <Card className="shadow-2xl backdrop-blur-sm bg-white/95">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">CG</span>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">
              COMPTECH GEAR UP
            </CardTitle>
            <CardDescription className="text-gray-600">
              Machine Management & Installation System
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Links */}
            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p className="mb-2">
                Don’t have an account?{" "}
                <Link to="/dealerregister" className="text-blue-600 underline">
                  Register
                </Link>
              </p>
              <p>
                Create Company?{" "}
                <Link to="/register" className="text-blue-600 underline">
                  Create Company
                </Link>
              </p>
            </div>

            {/* Demo account buttons */}
            <div className="border-t pt-4 mt-6">
              <p className="text-center text-sm text-muted-foreground mb-2">
                Demo Accounts (Click to fill):
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillCredentials("admin")}
                  type="button"
                >
                  System Admin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillCredentials("company_admin")}
                  type="button"
                >
                  Company Admin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillCredentials("company_employee")}
                  type="button"
                >
                  Company Employee
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillCredentials("dealer_admin")}
                  type="button"
                >
                  Dealer Admin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fillCredentials("dealer_employee")}
                  type="button"
                >
                  Dealer Employee
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
