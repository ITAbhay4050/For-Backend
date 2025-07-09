    import { useState, useMemo, useEffect, useCallback } from "react";
    import DashboardLayout from "@/components/Layout/DashboardLayout";
    import { useAuth } from "@/context/AuthContext";

    import {
      Card,
      CardContent,
      CardHeader,
      CardTitle,
    } from "@/components/ui/card";
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
    import {
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue,
    } from "@/components/ui/select";
    import {
      Plus,
      Search,
      Edit,
      Trash2,
      Building2,
      UserCircle,
      ChevronDown,
      ChevronRight,
    } from "lucide-react";
    import {
      User,
      UserRole,
      Company,
      Dealer,
      UserStatus,
    } from "@/types";
    import { toast } from "@/components/ui/use-toast";

    /* ------------------------------------------------------------------ */
    /* ENV / HELPERS                                                      */
    /* ------------------------------------------------------------------ */
    const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";
    const makeAuthHeaders = (token?: string) =>
      token
        ? { Authorization: `Token ${token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" };

    const normaliseDealer = (d: any): Dealer => ({
      id: String(d.id),
      companyId: String(d.company),
      name: d.name,
      contactPerson: d.contact_person ?? d.name,
      contactEmail: d.email,
      contactPhone: d.phone,
      address: d.address,
      gstNumber: d.gst_number,
    });

    const normaliseEmployee = (e: any): User => ({
      id: String(e.id),
      name: e.name,
      email: e.email,
      phone: e.phone,
      username: e.email.split("@")[0],
      role: e.role as UserRole,
      department: e.department,
      status: e.is_active ? UserStatus.ACTIVE : UserStatus.INACTIVE,
      companyId: e.company ? String(e.company) : undefined,
      dealerId: e.dealer ? String(e.dealer) : undefined,
      createdAt: e.created_at,
    });

    /* ------------------------------------------------------------------ */
    /* ROLE HELPERS                                                       */
    /* ------------------------------------------------------------------ */
    export const roleOptions: { value: UserRole; label: string }[] = [
      { value: UserRole.APPLICATION_ADMIN, label: "System Admin" },
      { value: UserRole.COMPANY_ADMIN, label: "Company Admin" },
      { value: UserRole.COMPANY_EMPLOYEE, label: "Company Employee" },
      { value: UserRole.DEALER_ADMIN, label: "Dealer Admin" },
      { value: UserRole.DEALER_EMPLOYEE, label: "Dealer Employee" },
    ];

    const getRoleName = (role: UserRole) =>
      roleOptions.find((r) => r.value === role)?.label ?? "User";

    const getRoleBadgeColor = (role: UserRole) => {
      switch (role) {
        case UserRole.APPLICATION_ADMIN:
          return "bg-red-100 text-red-800";
        case UserRole.COMPANY_ADMIN:
          return "bg-blue-100 text-blue-800";
        case UserRole.COMPANY_EMPLOYEE:
          return "bg-green-100 text-green-800";
        case UserRole.DEALER_ADMIN:
          return "bg-purple-100 text-purple-800";
        case UserRole.DEALER_EMPLOYEE:
          return "bg-orange-100 text-orange-800";
        default:
          return "bg-gray-100 text-gray-800";
      }
    };

    /* ------------------------------------------------------------------ */
    /* MOCK COMPANIES – replace with API if needed                        */
    /* ------------------------------------------------------------------ */
    const mockCompanies: Company[] = [
      {
        id: "1",
        name: "TechCorp Industries",
        address: "123 Business Ave",
        city: "Tech City",
        state: "TC",
        country: "USA",
        pinCode: "12345",
        contactPerson: "John Smith",
        contactEmail: "john.smith@techcorp.com",
        contactPhone: "+1 (555) 123-4567",
        gstNumber: "GST123456789",
        panNumber: "PAN123456789",
        status: UserStatus.ACTIVE,
        createdAt: "2023-01-01T00:00:00Z",
      },
      {
        id: "2",
        name: "Manufacturing Solutions Ltd",
        address: "456 Industrial Blvd",
        city: "Factory Town",
        state: "FT",
        country: "USA",
        pinCode: "67890",
        contactPerson: "Sarah Johnson",
        contactEmail: "sarah.johnson@mansol.com",
        contactPhone: "+1 (555) 987-6543",
        gstNumber: "GST987654321",
        panNumber: "PAN987654321",
        status: UserStatus.ACTIVE,
        createdAt: "2023-01-02T00:00:00Z",
      },
      {
        id: "3",
        name: "Global Enterprises Inc",
        address: "789 Corporate Plaza",
        city: "Business District",
        state: "BD",
        country: "USA",
        pinCode: "13579",
        contactPerson: "Michael Brown",
        contactEmail: "michael.brown@globalent.com",
        contactPhone: "+1 (555) 456-7890",
        gstNumber: "GST135792468",
        panNumber: "PAN135792468",
        status: UserStatus.ACTIVE,
        createdAt: "2023-01-03T00:00:00Z",
      },
    ];

    /* ------------------------------------------------------------------ */
    /* Dealer Search Component                                            */
    /* ------------------------------------------------------------------ */
    const DealerSearch = ({
      dealers,
      onSelect,
      value,
    }: {
      dealers: Dealer[];
      onSelect: (dealerId: string) => void;
      value?: string;
    }) => {
      const [searchTerm, setSearchTerm] = useState("");
      const [isOpen, setIsOpen] = useState(false);
      const [focusedIndex, setFocusedIndex] = useState(-1);

      const filteredDealers = useMemo(() => {
        if (searchTerm.length < 2) return [];
        
        const term = searchTerm.toLowerCase();
        return dealers.filter((dealer) => {
          return (
            dealer.name.toLowerCase().includes(term) ||
            (dealer.contactEmail && dealer.contactEmail.toLowerCase().includes(term)) ||
            (dealer.contactPhone && dealer.contactPhone.toLowerCase().includes(term)) ||
            (dealer.gstNumber && dealer.gstNumber.toLowerCase().includes(term))
          );
        });
      }, [searchTerm, dealers]);

      const handleSelect = (dealerId: string) => {
        onSelect(dealerId);
        setSearchTerm(dealers.find(d => d.id === dealerId)?.name || "");
        setIsOpen(false);
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFocusedIndex(prev => 
            prev < filteredDealers.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === "Enter" && focusedIndex >= 0) {
          e.preventDefault();
          handleSelect(filteredDealers[focusedIndex].id);
        } else if (e.key === "Escape") {
          setIsOpen(false);
        }
      };

      return (
        <div className="relative">
          <Input
            placeholder="Search dealers by name, email, phone or GST..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setFocusedIndex(-1);
              if (e.target.value.length >= 2) {
                setIsOpen(true);
              } else {
                setIsOpen(false);
              }
            }}
            onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            onKeyDown={handleKeyDown}
          />
          
          {isOpen && (
            <div className="w-[450px]">
              {filteredDealers.length > 0 ? (
                <ul>
                  {filteredDealers.map((dealer, index) => (
                    <li
                      key={dealer.id}
                      className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                        index === focusedIndex ? "bg-gray-100" : ""
                      }`}
                      onMouseDown={() => handleSelect(dealer.id)}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      <div className="font-medium">{dealer.name}</div>
                      <div className="text-sm text-gray-500">
                        {dealer.contactEmail} | {dealer.contactPhone}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-2 text-gray-500">
                  {searchTerm.length >= 2 ? "No dealers found" : "Type at least 2 characters to search"}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    /* ------------------------------------------------------------------ */
    /* UsersPage                                                          */
    /* ------------------------------------------------------------------ */
    const UsersPage = () => {
      const { user } = useAuth();
      const token = user?.token;

      /* ----------------------------- STATE ---------------------------- */
      const [users, setUsers] = useState<User[]>([]);
      const [dealers, setDealers] = useState<Dealer[]>([]);
      const [searchTerm, setSearchTerm] = useState("");
      const [expanded, setExpanded] = useState<Record<string, boolean>>({});
      const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
      const [isLoading, setIsLoading] = useState(false);

      type NewUserState = {
        name: string;
        email: string;
        phone: string;
        department?: string;
        password: string;
        confirmPassword: string;
        role: UserRole;
        companyId?: string;
        dealerId?: string;
      };

      const [newUser, setNewUser] = useState<NewUserState>({
        name: "",
        email: "",
        phone: "",
        department: "",
        password: "",
        confirmPassword: "",
        role:
          user?.role === UserRole.DEALER_ADMIN
            ? UserRole.DEALER_EMPLOYEE
            : UserRole.COMPANY_EMPLOYEE,
      });

      /* ---------------------------- LOAD DATA ------------------------ */
      const loadUsers = useCallback(async () => {
        try {
          const res = await fetch(`${API_BASE}/register/employee/`, {
            headers: makeAuthHeaders(token),
          });
          if (res.ok) {
            const json = await res.json();
            setUsers(json.map(normaliseEmployee));
          } else {
            throw new Error("Failed to fetch employees");
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to load employees",
            variant: "destructive",
          });
          console.error("Error loading employees:", error);
        }
      }, [token]);

      const loadDealers = useCallback(async () => {
        try {
          const res = await fetch(`${API_BASE}/dealers/`, {
            headers: makeAuthHeaders(token),
          });
          if (res.ok) {
            const json = await res.json();
            setDealers((json as any[]).map(normaliseDealer));
          } else {
            throw new Error("Failed to fetch dealers");
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to load dealers",
            variant: "destructive",
          });
          console.error("Error loading dealers:", error);
        }
      }, [token]);

      useEffect(() => {
        loadUsers();
        loadDealers();
      }, [loadUsers, loadDealers]);

      /* --------------------------- HELPERS --------------------------- */
      const dealerMap = useMemo(
        () => Object.fromEntries(dealers.map((d) => [d.id, d])),
        [dealers]
      );

      const toggleExpansion = (id: string) =>
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

      const canManageUsers =
        user?.role === UserRole.APPLICATION_ADMIN ||
        user?.role === UserRole.COMPANY_ADMIN ||
        user?.role === UserRole.DEALER_ADMIN;

      const companyDealers = useMemo(() => {
      // agar user company admin hai aur uska companyId mila
      if (user?.role === UserRole.COMPANY_ADMIN && user.companyId) {
        // filter karo dealers list me se sirf wahi jo usi company ke hain
        return dealers.filter((d) => d.companyId === user.companyId);
      }
      // warna sabhi dealers return karo
      return dealers;
    }, [dealers, user?.role, user?.companyId]);

      /* ------------------------- SEARCH ------------------------------ */
      const filteredUsers = useMemo(() => {
        if (!searchTerm.trim()) return users;

        const term = searchTerm.toLowerCase();
        const match = (s?: string) => s?.toLowerCase().includes(term);

        // First find all dealers that match the search criteria
        const matchedDealers = dealers.filter((dealer) => {
          return (
            match(dealer.name) ||
            match(dealer.contactPerson) ||
            match(dealer.contactEmail) ||
            match(dealer.contactPhone) ||
            match(dealer.gstNumber)
          );
        });

        // Get all user IDs from matched dealers (admin + employees)
        const matchedDealerUserIds = new Set<string>();
        matchedDealers.forEach((dealer) => {
          users.forEach((user) => {
            if (user.dealerId === dealer.id) {
              matchedDealerUserIds.add(user.id);
            }
          });
        });

        // Now filter users based on either:
        // 1. Direct user field match
        // 2. Belonging to a matched dealer
        return users.filter((user) => {
          // Check if user matches directly
          const userMatch = [user.name, user.email, user.username].some(match);
          
          // Check if user belongs to a matched dealer
          const dealerMatch = matchedDealerUserIds.has(user.id);
          
          return userMatch || dealerMatch;
        });
      }, [users, dealers, searchTerm]);

      const systemUsers = useMemo(
        () => filteredUsers.filter((u) => !u.companyId),
        [filteredUsers]
      );

      /* --------------------- CREATE / DELETE ------------------------- */
      const handleAddUser = async () => {
        if (
          !newUser.name ||
          !newUser.email ||
          !newUser.role ||
          !newUser.password
        ) {
          toast({
            title: "Validation Error",
            description: "Please fill all required fields",
            variant: "destructive",
          });
          return;
        }

        if (newUser.password !== newUser.confirmPassword) {
          toast({
            title: "Validation Error",
            description: "Passwords do not match",
            variant: "destructive",
          });
          return;
        }

        setIsLoading(true);

        try {
          const payload = {
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            department: newUser.department,
            role: newUser.role,
            password: newUser.password,
            company: newUser.companyId,
            dealer: newUser.dealerId,
          };

          const response = await fetch(`${API_BASE}/register/employee/`, {
            method: "POST",
            headers: makeAuthHeaders(token),
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            const createdEmployee = await response.json();
            setUsers(prev => [...prev, normaliseEmployee(createdEmployee)]);
            
            toast({
              title: "Success",
              description: "Employee registered successfully",
            });
            
            // Reset form
            setNewUser({
              name: "",
              email: "",
              phone: "",
              department: "",
              password: "",
              confirmPassword: "",
              role:
                user?.role === UserRole.DEALER_ADMIN
                  ? UserRole.DEALER_EMPLOYEE
                  : UserRole.COMPANY_EMPLOYEE,
            });
            setIsAddDialogOpen(false);
          } else {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to register employee");
          }
        } catch (error) {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to register employee",
            variant: "destructive",
          });
          console.error("Error registering employee:", error);
        } finally {
          setIsLoading(false);
        }
      };

      const handleDeleteUser = useCallback(async (id: string) => {
        try {
          const response = await fetch(`${API_BASE}/employee/${id}/`, {
            method: "DELETE",
            headers: makeAuthHeaders(token),
          });

          if (response.ok) {
            setUsers(prev => prev.filter(user => user.id !== id));
            toast({
              title: "Success",
              description: "Employee deleted successfully",
            });
          } else {
            throw new Error("Failed to delete employee");
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to delete employee",
            variant: "destructive",
          });
          console.error("Error deleting employee:", error);
        }
      }, [token]);

      /* -------------------------- ROW ------------------------------- */
      const UserRow = ({
        user: u,
        level = 0,
      }: {
        user: User;
        level?: number;
      }) => (
        <TableRow>
          <TableCell
            className="font-medium"
            style={{ paddingLeft: `${level * 20 + 16}px` }}
          >
            <div className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              {u.name}
            </div>
          </TableCell>
          <TableCell>{u.email}</TableCell>
          <TableCell>
            <Badge className={getRoleBadgeColor(u.role)}>
              {getRoleName(u.role)}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4" />
              </Button>
              {canManageUsers && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteUser(u.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      );

      /* ------------------------------------------------------------------
      * RENDER
      * ------------------------------------------------------------------ */
      return (
        <DashboardLayout>
          <div className="space-y-6">
            {/* HEADER + ADD BUTTON */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  Users Management
                </h2>
                <p className="text-muted-foreground">
                  {user?.role === UserRole.APPLICATION_ADMIN
                    ? "Manage all users across companies in hierarchical structure"
                    : "Manage users in your organization"}
                </p>
              </div>

              {canManageUsers && (
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={setIsAddDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> Add User
                    </Button>
                  </DialogTrigger>

                  {/* -------------- ADD USER DIALOG -------------- */}
                  <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-white to-blue-50 border rounded-xl shadow-lg">
                    <DialogHeader>
                      <DialogTitle className="text-blue-700">
                        Add New User
                      </DialogTitle>
                      <DialogDescription>
                        Fill in the employee details below.
                      </DialogDescription>
                    </DialogHeader>

                    {/* ---------- FORM FIELDS ---------- */}
                    <div className="grid gap-4 py-4">
                      {/* NAME */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                          Name
                        </Label>
                        <Input
                          id="name"
                          value={newUser.name}
                          onChange={(e) =>
                            setNewUser({ ...newUser, name: e.target.value })
                          }
                          className="col-span-3"
                          placeholder="Full name"
                          required
                        />
                      </div>

                      {/* EMAIL */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) =>
                            setNewUser({ ...newUser, email: e.target.value })
                          }
                          className="col-span-3"
                          placeholder="user@example.com"
                          required
                        />
                      </div>

                      {/* PHONE */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phone" className="text-right">
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={newUser.phone}
                          onChange={(e) =>
                            setNewUser({ ...newUser, phone: e.target.value })
                          }
                          className="col-span-3"
                          placeholder="+91-XXXXXXXXXX"
                        />
                      </div>

                      {/* DEPARTMENT */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="department" className="text-right">
                          Department
                        </Label>
                        <Input
                          id="department"
                          value={newUser.department}
                          onChange={(e) =>
                            setNewUser({
                              ...newUser,
                              department: e.target.value,
                            })
                          }
                          className="col-span-3"
                          placeholder="Optional"
                        />
                      </div>

                      {/* ROLE */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">
                          Role
                        </Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value) =>
                            setNewUser({
                              ...newUser,
                              role: value as UserRole,
                              // reset company/dealer id if role changes
                              companyId:
                                value === UserRole.COMPANY_EMPLOYEE ||
                                value === UserRole.COMPANY_ADMIN
                                  ? newUser.companyId
                                  : undefined,
                              dealerId:
                                value === UserRole.DEALER_EMPLOYEE ||
                                value === UserRole.DEALER_ADMIN
                                  ? newUser.dealerId
                                  : undefined,
                            })
                          }
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions
                              .filter((o) => {
                                if (user?.role === UserRole.DEALER_ADMIN)
                                  return o.value === UserRole.DEALER_EMPLOYEE;
                                if (user?.role === UserRole.COMPANY_ADMIN)
                                  return (
                                    o.value === UserRole.COMPANY_EMPLOYEE ||
                                    o.value === UserRole.DEALER_EMPLOYEE
                                  );
                                return true;
                              })
                              .map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* COMPANY (System Admin creating company users) */}
                      {user?.role === UserRole.APPLICATION_ADMIN &&
                        (newUser.role === UserRole.COMPANY_ADMIN ||
                          newUser.role === UserRole.COMPANY_EMPLOYEE) && (
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="company" className="text-right">
                              Company
                            </Label>
                            <Select
                              value={newUser.companyId}
                              onValueChange={(value) =>
                                setNewUser({ ...newUser, companyId: value })
                              }
                            >
                              <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select company" />
                              </SelectTrigger>
                              <SelectContent>
                                {mockCompanies.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                      {/* DEALER (Company Admin creating Dealer employees) */}
                      {(user?.role === UserRole.COMPANY_ADMIN || user?.role === UserRole.APPLICATION_ADMIN) &&
                        (newUser.role === UserRole.DEALER_EMPLOYEE || newUser.role === UserRole.DEALER_ADMIN) && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="dealer" className="text-right">
                              Dealer
                            </Label>
                            <div className="col-span-3">
                              <DealerSearch
                                dealers={companyDealers}
                                onSelect={(dealerId) => setNewUser({ ...newUser, dealerId })}
                                value={newUser.dealerId}
                              />
                            </div>
                          </div>
                        )}

                      {/* PASSWORD */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">
                          Password
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) =>
                            setNewUser({ ...newUser, password: e.target.value })
                          }
                          className="col-span-3"
                          placeholder="New password"
                          required
                        />
                      </div>

                      {/* CONFIRM PASSWORD */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="confirmPassword" className="text-right">
                          Confirm
                        </Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={newUser.confirmPassword}
                          onChange={(e) =>
                            setNewUser({
                              ...newUser,
                              confirmPassword: e.target.value,
                            })
                          }
                          className="col-span-3"
                          placeholder="Confirm password"
                          required
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        onClick={handleAddUser}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                        disabled={isLoading}
                      >
                        {isLoading ? "Registering..." : "Register Employee"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                  {/* -------------- /ADD USER DIALOG -------------- */}
                </Dialog>
              )}
            </div>

            {/* SEARCH */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" /> Search Users / Dealers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Search by user name, email, or dealer details (name, contact, email, phone, GST)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-lg"
                />
              </CardContent>
            </Card>

            {/* SYSTEM USERS */}
            {user?.role === UserRole.APPLICATION_ADMIN &&
              systemUsers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserCircle className="h-5 w-5" /> System Users (
                      {systemUsers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemUsers.map((u) => (
                          <UserRow key={u.id} user={u} />
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

            {/* COMPANY HIERARCHY */}
            {user?.role === UserRole.APPLICATION_ADMIN && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" /> Company Hierarchy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockCompanies.map((company) => {
                        const companyAdmins = filteredUsers.filter(
                          (u) =>
                            u.companyId === company.id &&
                            u.role === UserRole.COMPANY_ADMIN
                        );
                        const companyEmployees = filteredUsers.filter(
                          (u) =>
                            u.companyId === company.id &&
                            u.role === UserRole.COMPANY_EMPLOYEE
                        );
                        const dealerAdmins = filteredUsers.filter(
                          (u) =>
                            u.companyId === company.id &&
                            u.role === UserRole.DEALER_ADMIN
                        );

                        const totalUsers =
                          companyAdmins.length +
                          companyEmployees.length +
                          dealerAdmins.length;

                        const compKey = `company-${company.id}`;
                        if (totalUsers === 0) return null;

                        return (
                          <div key={compKey}>
                            <TableRow className="bg-muted/30">
                              <TableCell
                                className="font-semibold cursor-pointer"
                                onClick={() => toggleExpansion(compKey)}
                              >
                                <div className="flex items-center gap-2">
                                  {expanded[compKey] ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <Building2 className="h-4 w-4" /> {company.name} (
                                  {totalUsers} users)
                                </div>
                              </TableCell>
                              <TableCell colSpan={3} className="text-muted-foreground">
                                {company.contactEmail}
                              </TableCell>
                            </TableRow>

                            {expanded[compKey] && (
                              <>
                                {companyAdmins.map((u) => (
                                  <UserRow key={u.id} user={u} level={1} />
                                ))}

                                {companyEmployees.map((u) => (
                                  <UserRow key={u.id} user={u} level={2} />
                                ))}

                                {/* Dealer Admins + employees */}
                                {dealerAdmins.map((dealerAdmin) => {
                                  const dealerKey = `dealer-${dealerAdmin.dealerId}`;
                                  const dealerEmployees = filteredUsers.filter(
                                    (u) =>
                                      u.dealerId === dealerAdmin.dealerId &&
                                      u.role === UserRole.DEALER_EMPLOYEE
                                  );

                                  return (
                                    <div key={dealerAdmin.id}>
                                      <TableRow>
                                        <TableCell
                                          className="font-medium cursor-pointer"
                                          style={{ paddingLeft: "40px" }}
                                          onClick={() =>
                                            dealerAdmin.dealerId &&
                                            toggleExpansion(dealerKey)
                                          }
                                        >
                                          <div className="flex items-center gap-2">
                                            {dealerEmployees.length > 0 &&
                                              (expanded[dealerKey] ? (
                                                <ChevronDown className="h-4 w-4" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4" />
                                              ))}
                                            <UserCircle className="h-4 w-4 text-muted-foreground" />
                                            {dealerAdmin.name}
                                            {dealerEmployees.length > 0 && (
                                              <>
                                                {" "}
                                                ({dealerEmployees.length} employees)
                                              </>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell>{dealerAdmin.email}</TableCell>
                                        <TableCell>
                                          <Badge
                                            className={getRoleBadgeColor(
                                              dealerAdmin.role
                                            )}
                                          >
                                            {getRoleName(dealerAdmin.role)}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm">
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                handleDeleteUser(dealerAdmin.id)
                                              }
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>

                                      {/* Dealer employees */}
                                      {expanded[dealerKey] &&
                                        dealerEmployees.map((emp) => (
                                          <UserRow
                                            key={emp.id}
                                            user={emp}
                                            level={3}
                                          />
                                        ))}
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </DashboardLayout>
      );
    };

    export default UsersPage;