import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

interface Company {
  id: number;
  name: string;
}

const DealerRegister = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    pin_code: '',
    gst_no: '',
    pan_no: '',
    company: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [tempDealerData, setTempDealerData] = useState<typeof formData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const [isNameEditable, setIsNameEditable] = useState(true);
  const [isEmailEditable, setIsEmailEditable] = useState(true);
  const [isPanNoEditable, setIsPanNoEditable] = useState(true);

  // Fetch companies
  useEffect(() => {
    // CORRECTED: Fetch from /api/companies/ for listing
    fetch('http://127.0.0.1:8000/api/companies/')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCompanies(data);
        } else {
          setCompanies([]);
        }
      })
      .catch(() =>
        toast({
          title: 'Error',
          description: 'Failed to load company list.',
          variant: 'destructive',
        })
      );
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });

    if (e.target.name === 'gst_no') {
      // Reset editable states when GST changes
      setIsNameEditable(true);
      setIsEmailEditable(true);
      setIsPanNoEditable(true);
    }
  };

  const handleGetDealerData = async () => {
    if (!formData.gst_no) {
      toast({
        title: 'Input Required',
        description: 'Please enter a GST number.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // CORRECTED: Fetch from /api/party/get-details-by-gst/
      const res = await fetch(
        `http://127.0.0.1:8000/api/party/get-details-by-gst/?gst_no=${formData.gst_no}`
      );
      if (res.ok) {
        const data = await res.json();
        setFormData((prev) => ({
          ...prev,
          name: data.name || '',
          email: data.email || '',
          pan_no: data.pan_no || '',
        }));
        // Set fields as non-editable after fetching
        setIsNameEditable(false);
        setIsEmailEditable(false);
        setIsPanNoEditable(false);

        toast({
          title: 'Success',
          description: 'Dealer data fetched.',
        });
      } else {
        const errorData = await res.json();
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to fetch dealer data.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error while fetching dealer data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: 'Password Mismatch',
        description: 'Passwords do not match.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/api/send-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });

      if (res.ok) {
        setTempDealerData(formData);
        setShowOtp(true);
        toast({
          title: 'OTP Sent',
          description: 'Check your email for the OTP.',
        });
      } else {
        toast({
          title: 'Failed',
          description: 'Could not send OTP.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Unable to send OTP.',
        variant: 'destructive',
      });
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/verify-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tempDealerData?.email, otp }),
      });

      if (res.ok) {
        const registerRes = await fetch('http://127.0.0.1:8000/api/dealers/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...tempDealerData,
            password: tempDealerData?.newPassword,
          }),
        });

        if (registerRes.ok) {
          toast({
            title: 'Success',
            description: 'Dealer registered successfully!',
          });
          setTimeout(() => navigate('/login'), 2000);
        } else {
          // Attempt to parse error message from server
          const errorData = await registerRes.json();
          const errorMessage = errorData.detail || errorData.email || 'Dealer registration failed.';
          toast({
            title: 'Error',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      } else {
        const errorData = await res.json();
        const errorMessage = errorData.detail || 'OTP verification failed.';
        toast({
          title: 'Invalid OTP',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to verify OTP or network error during registration.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 px-4 py-8 animate-fade-in">
      <div className="w-full max-w-2xl">
        <Card className="rounded-2xl shadow-2xl border-none">
          <CardHeader>
            <CardTitle className="text-3xl font-extrabold text-center text-purple-700">
              Dealer Registration
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Fill in the form to register as a dealer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* GST Field */}
              <div className="space-y-1">
                <Label htmlFor="gst_no">GST Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="gst_no"
                    name="gst_no"
                    type="text"
                    value={formData.gst_no}
                    onChange={handleChange}
                    placeholder="Enter GST Number"
                    className="flex-1"
                    required
                  />
                  <Button
                    type="button"
                    onClick={handleGetDealerData}
                    disabled={!formData.gst_no || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isLoading ? 'Fetching...' : 'Get Data'}
                  </Button>
                </div>
              </div>

              {/* Name, Email, PAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'name', label: 'Dealer Name', editable: isNameEditable },
                  { name: 'email', label: 'Email', editable: isEmailEditable, type: 'email' },
                  { name: 'pan_no', label: 'PAN Number', editable: isPanNoEditable },
                ].map((field) => (
                  <div key={field.name} className="space-y-1">
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type={field.type || 'text'}
                      value={formData[field.name as keyof typeof formData]}
                      onChange={handleChange}
                      readOnly={!field.editable}
                      className={!field.editable ? 'bg-gray-100 cursor-not-allowed' : ''}
                      required
                    />
                  </div>
                ))}

                {/* Other Fields */}
                {[
                  'phone',
                  'address',
                  'city',
                  'state',
                  'country',
                  'pin_code',
                ].map((field) => (
                  <div key={field} className="space-y-1">
                    <Label htmlFor={field}>{field.replace('_', ' ').toUpperCase()}</Label>
                    <Input
                      id={field}
                      name={field}
                      type="text"
                      value={formData[field as keyof typeof formData]}
                      onChange={handleChange}
                      required
                    />
                  </div>
                ))}

                {/* Company Selection */}
                <div className="space-y-1">
                  <Label htmlFor="company">Select Company</Label>
                  <select
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full border rounded-md p-2 h-10 bg-white dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 focus:ring-purple-500 focus:border-purple-500"
                    required
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* OTP */}
              {!showOtp ? (
                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Send OTP
                </Button>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="otp">Enter OTP</Label>
                    <Input
                      id="otp"
                      name="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter OTP sent to email"
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    Verify & Register
                  </Button>
                </>
              )}

              <div className="text-center text-sm mt-4">
                Already registered?{' '}
                <Link to="/login" className="text-blue-600 hover:underline">
                  Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DealerRegister;