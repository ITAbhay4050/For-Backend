import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash2, Store, Mail, Phone, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Dealer {
  id: string;
  name: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  gst_no: string;
  company?: string;
}

const Dealers = () => {
  const { user } = useAuth();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDealer, setNewDealer] = useState<Omit<Dealer, 'id'>>({
    name: '',
    email: '',
    phone: '',
    state: '',
    city: '',
    gst_no: ''
  });

  useEffect(() => {
    const fetchDealers = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://127.0.0.1:8000/api/register/dealer/', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch dealers');
        }

        const data = await response.json();
        setDealers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDealers();
  }, []);

  const filteredDealers = dealers.filter(dealer => {
    const term = searchTerm.toLowerCase();
    return (
      dealer.name.toLowerCase().includes(term) ||
      dealer.email.toLowerCase().includes(term) ||
      dealer.phone.toLowerCase().includes(term)
    );
  });

  const handleAddDealer = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/register/dealer/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newDealer)
      });

      if (!response.ok) {
        throw new Error('Failed to add dealer');
      }

      const data = await response.json();
      setDealers([...dealers, data]);
      setNewDealer({
        name: '',
        email: '',
        phone: '',
        state: '',
        city: '',
        gst_no: ''
      });
      setIsAddDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dealer');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <p>Loading dealers...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <p className="text-red-500">{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dealers Management</h2>
            <p className="text-muted-foreground">
              {user?.role === 'COMPANY_ADMIN' 
                ? 'Manage dealers associated with your company'
                : 'Manage all dealers in the system'
              }
            </p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Dealer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Dealer</DialogTitle>
                <DialogDescription>Enter dealer details below.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {Object.entries(newDealer).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor={key} className="text-right capitalize">
                      {key.replace('_', ' ')}
                    </Label>
                    <Input
                      id={key}
                      value={value}
                      onChange={(e) => setNewDealer({...newDealer, [key]: e.target.value})}
                      className="col-span-3"
                      placeholder={`Enter ${key.replace('_', ' ')}`}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={handleAddDealer}>Add Dealer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Dealers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Dealers ({filteredDealers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>GST No.</TableHead>
                  {user?.role === 'APPLICATION_ADMIN' && <TableHead>Company</TableHead>}
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDealers.map((dealer) => (
                  <TableRow key={dealer.id}>
                    <TableCell className="font-medium">{dealer.name}</TableCell>
                    <TableCell>{dealer.email}</TableCell>
                    <TableCell>{dealer.phone}</TableCell>
                    <TableCell>{dealer.state}</TableCell>
                    <TableCell>{dealer.city}</TableCell>
                    <TableCell>{dealer.gst_no}</TableCell>
                    {user?.role === 'APPLICATION_ADMIN' && (
                      <TableCell>{dealer.company}</TableCell>
                    )}
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteDealer(dealer.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dealers;