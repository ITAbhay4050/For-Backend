import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit, Trash2, Store, Users, MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { Dealer, Company, UserRole } from '@/types';
import { useAuth } from '@/context/AuthContext';

// Mock data - in a real app this would come from an API
const mockCompanies: Company[] = [
  {
    id: '1',
    name: 'TechCorp Industries',
    address: '123 Business Ave, Tech City, TC 12345',
    contactPerson: 'John Smith',
    contactEmail: 'john.smith@techcorp.com',
    contactPhone: '+1 (555) 123-4567'
  },
  {
    id: '2',
    name: 'Manufacturing Solutions Ltd',
    address: '456 Industrial Blvd, Factory Town, FT 67890',
    contactPerson: 'Sarah Johnson',
    contactEmail: 'sarah.johnson@mansol.com',
    contactPhone: '+1 (555) 987-6543'
  }
];

const mockDealers: Dealer[] = [
  {
    id: '1',
    name: 'Metro Sales & Service',
    address: '789 Dealer Street, Metro City, MC 11111',
    contactPerson: 'Alex Wilson',
    contactEmail: 'alex.wilson@metrosales.com',
    contactPhone: '+1 (555) 111-2222',
    companyId: '1'
  },
  {
    id: '2',
    name: 'Regional Equipment Distributors',
    address: '321 Distribution Ave, Regional Town, RT 33333',
    contactPerson: 'Emma Davis',
    contactEmail: 'emma.davis@regionaleq.com',
    contactPhone: '+1 (555) 333-4444',
    companyId: '1'
  },
  {
    id: '3',
    name: 'Premier Solutions Group',
    address: '654 Premier Plaza, Solution City, SC 55555',
    contactPerson: 'Robert Martinez',
    contactEmail: 'robert.martinez@premiersol.com',
    contactPhone: '+1 (555) 555-6666',
    companyId: '2'
  }
];

const Dealers = () => {
  const { user } = useAuth();
  const [dealers, setDealers] = useState<Dealer[]>(mockDealers);
  const [companies] = useState<Company[]>(mockCompanies);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDealer, setNewDealer] = useState({
    name: '',
    address: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    companyId: ''
  });

  // Filter dealers based on user role and company
  const getFilteredDealers = () => {
    let dealersToShow = dealers;
    
    // If user is Company Admin, only show dealers from their company
    if (user?.role === UserRole.COMPANY_ADMIN && user?.companyId) {
      dealersToShow = dealers.filter(dealer => dealer.companyId === user.companyId);
    }
    
    // Apply search filter
    return dealersToShow.filter(dealer =>
      dealer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dealer.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dealer.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Filter companies based on user role
  const getFilteredCompanies = () => {
    // If user is Company Admin, only show their company
    if (user?.role === UserRole.COMPANY_ADMIN && user?.companyId) {
      return companies.filter(company => company.id === user.companyId);
    }
    
    // For Application Admin, show all companies
    return companies;
  };

  const filteredDealers = getFilteredDealers();
  const filteredCompanies = getFilteredCompanies();

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company ? company.name : 'Unknown Company';
  };

  const getDealerCountForCompany = (companyId: string) => {
    const relevantDealers = user?.role === UserRole.COMPANY_ADMIN && user?.companyId 
      ? dealers.filter(dealer => dealer.companyId === user.companyId)
      : dealers;
    
    return relevantDealers.filter(dealer => dealer.companyId === companyId).length;
  };

  const handleAddDealer = () => {
    // If Company Admin, automatically set their company ID
    const dealerData = {
      ...newDealer,
      companyId: user?.role === UserRole.COMPANY_ADMIN && user?.companyId 
        ? user.companyId 
        : newDealer.companyId
    };

    const dealer: Dealer = {
      id: Date.now().toString(),
      ...dealerData
    };
    setDealers([...dealers, dealer]);
    setNewDealer({
      name: '',
      address: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      companyId: ''
    });
    setIsAddDialogOpen(false);
  };

  const handleDeleteDealer = (id: string) => {
    setDealers(dealers.filter(dealer => dealer.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {user?.role === UserRole.COMPANY_ADMIN ? 'Company Dealers' : 'Dealers & Companies'}
            </h2>
            <p className="text-muted-foreground">
              {user?.role === UserRole.COMPANY_ADMIN 
                ? 'Manage dealers associated with your company'
                : 'Manage dealers, their company associations, and view all companies'
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
                <DialogDescription>
                  Enter the dealer details below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={newDealer.name}
                    onChange={(e) => setNewDealer({...newDealer, name: e.target.value})}
                    className="col-span-3"
                    placeholder="Dealer name"
                  />
                </div>
                {user?.role !== UserRole.COMPANY_ADMIN && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="company" className="text-right">
                      Company
                    </Label>
                    <Select 
                      value={newDealer.companyId}
                      onValueChange={(value) => setNewDealer({...newDealer, companyId: value})}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {user?.role === UserRole.COMPANY_ADMIN && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Company</Label>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      {getCompanyName(user.companyId || '')}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="address" className="text-right">
                    Address
                  </Label>
                  <Input
                    id="address"
                    value={newDealer.address}
                    onChange={(e) => setNewDealer({...newDealer, address: e.target.value})}
                    className="col-span-3"
                    placeholder="Full address"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="contactPerson" className="text-right">
                    Contact Person
                  </Label>
                  <Input
                    id="contactPerson"
                    value={newDealer.contactPerson}
                    onChange={(e) => setNewDealer({...newDealer, contactPerson: e.target.value})}
                    className="col-span-3"
                    placeholder="Contact person name"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="contactEmail" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={newDealer.contactEmail}
                    onChange={(e) => setNewDealer({...newDealer, contactEmail: e.target.value})}
                    className="col-span-3"
                    placeholder="contact@dealer.com"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="contactPhone" className="text-right">
                    Phone
                  </Label>
                  <Input
                    id="contactPhone"
                    value={newDealer.contactPhone}
                    onChange={(e) => setNewDealer({...newDealer, contactPhone: e.target.value})}
                    className="col-span-3"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddDealer}>Add Dealer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* All Companies List - Only show for Application Admin */}
        {user?.role === UserRole.APPLICATION_ADMIN && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                All Companies ({filteredCompanies.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Connected Dealers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {company.contactPerson}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {company.contactEmail}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {company.contactPhone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="max-w-xs truncate">{company.address}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Store className="h-3 w-3" />
                          {getDealerCountForCompany(company.id)} Dealers
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Company Info for Company Admin */}
        {user?.role === UserRole.COMPANY_ADMIN && user?.companyId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Your Company
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCompanies.map((company) => (
                <div key={company.id} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-lg">{company.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {company.address}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Contact:</span> {company.contactPerson}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {company.contactEmail}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {company.contactPhone}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    <Store className="h-3 w-3" />
                    {getDealerCountForCompany(company.id)} Dealers
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Search Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Dealers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search by dealer name, contact person, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </CardContent>
        </Card>

        {/* Dealers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {user?.role === UserRole.COMPANY_ADMIN ? 'Company Dealers' : 'Dealers'} ({filteredDealers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dealer Name</TableHead>
                  {user?.role === UserRole.APPLICATION_ADMIN && <TableHead>Associated Company</TableHead>}
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                
                {filteredDealers.map((dealer) => (
                  <TableRow key={dealer.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        {dealer.name}
                      </div>
                    </TableCell>
                    {user?.role === UserRole.APPLICATION_ADMIN && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="secondary">
                            {getCompanyName(dealer.companyId)}
                          </Badge>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {dealer.contactPerson}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {dealer.contactEmail}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {dealer.contactPhone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="max-w-xs truncate">{dealer.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
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
