import { useState } from 'react';
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

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    address: '',
    city: '',
    state: '',
    country: '',
    pin_code: '',
    contact_phone: '',
    contact_email: '',
    gst_no: '',
    pan_no: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: 'Password Mismatch',
        description: 'New password and confirm password do not match.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/register/company/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          contact_person: formData.contact_person,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          country: formData.country,
          pin_code: formData.pin_code,
          contact_phone: formData.contact_phone,
          contact_email: formData.contact_email,
          gst_no: formData.gst_no,
          pan_no: formData.pan_no,
          password: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Registration Successful',
          description: 'Your company has been registered successfully.',
        });
        navigate('/login');
      } else {
        toast({
          title: 'Registration Failed',
          description: data.message || 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Server Error',
        description: 'Unable to register. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 px-4 py-8 animate-fade-in">
      <div className="w-full max-w-2xl">
        <Card className="rounded-2xl shadow-2xl border-none">
          <CardHeader>
            <CardTitle className="text-3xl font-extrabold text-center text-purple-700">
              Company Registration
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Please fill in the form below to register your company.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { name: 'gst_no', label: 'GST Number' },
                  { name: 'name', label: 'Company Name' },
                  { name: 'contact_person', label: 'Contact Person' },
                  { name: 'address', label: 'Address' },
                  { name: 'city', label: 'City' },
                  { name: 'state', label: 'State' },
                  { name: 'country', label: 'Country' },
                  { name: 'pin_code', label: 'PIN Code' },
                  { name: 'contact_phone', label: 'Phone' },
                  { name: 'contact_email', label: 'Email', type: 'email' },
                  { name: 'pan_no', label: 'PAN Number' },
                ].map((field) => (
                  <div key={field.name} className="space-y-1">
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type={field.type || 'text'}
                      placeholder={field.label}
                      value={formData[field.name as keyof typeof formData]}
                      onChange={handleChange}
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    placeholder="New Password"
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
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-xl transition duration-300"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Registering...' : 'Register'}
              </Button>

              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">
                  Already registered?{' '}
                  <Link to="/login" className="text-blue-600 hover:underline">
                    Login
                  </Link>
                </span>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
