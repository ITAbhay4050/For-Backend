import {
  useState,
  useEffect,
  FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Cog as Gear, Wrench, Cpu, ShieldCheck } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();      // <-- AuthContext now posts to /api/login/ for all roles
  const navigate = useNavigate();

  /* ---------- rotating gear animation (500 RPM) ---------- */
  useEffect(() => {
    const gears = document.querySelectorAll(".gear-animation");
    let af: number;

    const spin = (t: number) => {
      const rot = (t / 120) % 360;
      gears.forEach((g, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        (g as HTMLElement).style.transform = `rotate(${rot * dir}deg)`;
      });
      af = requestAnimationFrame(spin);
    };
    af = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(af);
  }, []);

  /* ---------- helpers ---------- */
  const showToast = (
    title: string,
    description: string,
    variant: "destructive" | "default" = "default",
  ) => toast({ title, description, variant });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast(
        "Validation Error",
        "Please enter both email and password.",
        "destructive",
      );
      return;
    }

    setIsSubmitting(true);
    const ok = await login(email, password);
    setIsSubmitting(false);

    if (ok) {
      showToast("Login Successful", "Welcome back!");
      navigate("/dashboard");
    } else {
      showToast("Login Failed", "Invalid credentials", "destructive");
    }
  };

  /* ---------- quick‑fill demo creds ---------- */
  const fillCredentials = (preset: string) => {
    switch (preset) {
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

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* background gears */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 w-80 h-80">
          <Gear className="w-full h-full text-blue-500/10 gear-animation origin-center" />
        </div>
        <div className="absolute -right-40 -bottom-40 w-96 h-96">
          <Gear className="w-full h-full text-blue-700/10 gear-animation origin-center" />
        </div>
        <div className="absolute right-1/4 top-1/3 w-64 h-64">
          <Gear className="w-full h-full text-blue-600/10 gear-animation origin-center" />
        </div>
      </div>

      {/* main card */}
      <div className="w-full max-w-md px-4 relative z-10">
        <Card className="shadow-xl bg-white/90 backdrop-blur-sm border border-gray-200">
          <CardHeader className="space-y-6 text-center">
            {/* logo */}
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 mb-4 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center shadow-lg">
                    <Cpu className="w-10 h-10 text-white" />
                  </div>
                  <Wrench className="absolute -bottom-2 -right-2 w-6 h-6 text-orange-400" />
                </div>
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-bold text-blue-800">COMPTECH</h1>
                <p className="text-blue-600 mt-1 text-sm">Shaping a better future</p>
              </div>
            </div>

            <CardTitle className="text-xl font-semibold text-gray-800">
              Machine Service Portal
            </CardTitle>
            <CardDescription className="text-gray-500">
              Sign in to access your account
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* email */}
              <div className="space-y-3">
                <Label htmlFor="email" className="text-gray-700 flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-600"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@comptech.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* password */}
              <div className="space-y-3">
                <Label htmlFor="password" className="text-gray-700 flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-600"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* submit */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-2 px-4 rounded-md transition-all duration-300 shadow hover:shadow-md"
                disabled={isSubmitting}
              >
                <div className="flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Sign In
                    </>
                  )}
                </div>
              </Button>
            </form>

            {/* links */}
            <div className="mt-6 text-center text-sm">
              <p className="mb-2 text-gray-600">
                Don&apos;t have an account?{" "}
                <Link
                  to="/dealerregister"
                  className="text-blue-600 hover:text-blue-800 underline underline-offset-4 transition-colors"
                >
                  Register
                </Link>
              </p>
              <p className="text-gray-600">
                Create Company?{" "}
                <Link
                  to="/register"
                  className="text-blue-600 hover:text-blue-800 underline underline-offset-4 transition-colors"
                >
                  Create Company
                </Link>
              </p>
            </div>

            {/* demo buttons */}
            <div className="border-t border-gray-200 pt-5 mt-6">
              <p className="text-center text-sm text-gray-600 mb-3">
                Demo Accounts (click to autofill):
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  ["System Admin", "admin", "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"],
                  ["Company Admin", "company_admin", "bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200"],
                  ["Company Employee", "company_employee", "bg-green-100 text-green-800 border-green-200 hover:bg-green-200"],
                  ["Dealer Admin", "dealer_admin", "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200"],
                  ["Dealer Employee", "dealer_employee", "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200"],
                ].map(([label, key, cls]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => fillCredentials(key as string)}
                    className={cls as string}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
