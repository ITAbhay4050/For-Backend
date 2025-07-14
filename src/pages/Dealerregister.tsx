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

const DealerRegister = () => {
  const [companies, setCompanies] = useState([]);
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
  const [tempDealerData, setTempDealerData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/register/company/')
      .then((res) => res.json())
      .then((data) => setCompanies(data))
      .catch(() =>
        toast({
          title: 'Error',
          description: 'Failed to load company list.',
          variant: 'destructive',
        })
      );
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
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
        setShowOtp(true);
        setTempDealerData(formData);
        toast({
          title: 'OTP Sent',
          description: 'Please check your email for the OTP.',
        });
      } else {
        toast({
          title: 'OTP Failed',
          description: 'Could not send OTP.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Failed to send OTP.',
        variant: 'destructive',
      });
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/verify-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tempDealerData.email, otp }),
      });

      if (res.ok) {
        const registerRes = await fetch('http://127.0.0.1:8000/api/dealers/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...tempDealerData,
            password: tempDealerData.newPassword,
          }),
        });

        if (registerRes.ok) {
          toast({
            title: 'Success',
            description: 'Dealer registered successfully!',
          });
          setTimeout(() => navigate('/login'), 2000); // wait 2 seconds before navigating
        } else {
          toast({
            title: 'Error',
            description: 'Registration failed.',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Invalid OTP',
          description: 'OTP verification failed.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Something went wrong while verifying OTP.',
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'name', label: 'Dealer Name' },
                  { name: 'email', label: 'Email', type: 'email' },
                  { name: 'phone', label: 'Phone' },
                  { name: 'address', label: 'Address' },
                  { name: 'city', label: 'City' },
                  { name: 'state', label: 'State' },
                  { name: 'country', label: 'Country' },
                  { name: 'pin_code', label: 'PIN Code' },
                  { name: 'gst_no', label: 'GST Number' },
                  { name: 'pan_no', label: 'PAN Number' },
                ].map((field) => (
                  <div key={field.name} className="space-y-1">
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type={field.type || 'text'}
                      placeholder={field.label}
                      value={formData[field.name]}
                      onChange={handleChange}
                      required
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label htmlFor="company">Select Company</Label>
                  <select
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full border rounded-md p-2"
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

              {/* Password Fields */}
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

              {/* OTP Logic */}
              {!showOtp ? (
                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white">
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
                      placeholder="Enter OTP sent to email"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
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
