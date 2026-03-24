import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, Eye, Truck, RefreshCw, Plus, Download } from 'lucide-react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Types
import { UserRole } from '../types';

// =============================================================================
// STATIC DATA (No backend)
// =============================================================================

interface StockItem {
  id: number;
  product_name: string;
  product_code: string;
  batch_number: string;
  purchase_date: string;
  quantity: number;
  status: 'available' | 'sold' | 'returned';
  dealer_id?: number;
  dealer_name?: string;
  customer_name?: string;
  customer_address?: string;
  phone?: string;
  sell_date?: string;
  return_reason?: string;
  bill_photo_url?: string;
}

interface DealerSummary {
  id: number;
  name: string;
  total_available_stock: number;
}

interface PurchaseOrder {
  id: number;
  dealer_id: number;
  dealer_name: string;
  item_name: string;
  item_code: string;
  product_code: string;
  order_quantity: number;
  pending_quantity: number;
  remarks: string;
  order_date: string;
  status: 'pending' | 'partially_completed' | 'completed';
}

// Dealer's own stock (for dealer view)
const dealerOwnStock: StockItem[] = [
  {
    id: 1,
    product_name: 'High-Pressure Washer',
    product_code: 'HPW-2000',
    batch_number: 'BATCH-001',
    purchase_date: '2024-01-15',
    quantity: 10,
    status: 'available',
  },
  {
    id: 2,
    product_name: 'Industrial Vacuum Cleaner',
    product_code: 'IVC-500',
    batch_number: 'BATCH-002',
    purchase_date: '2024-01-20',
    quantity: 5,
    status: 'available',
  },
  {
    id: 3,
    product_name: 'Air Compressor',
    product_code: 'AC-3000',
    batch_number: 'BATCH-003',
    purchase_date: '2024-02-10',
    quantity: 2,
    status: 'sold',
    customer_name: 'John Doe',
    customer_address: '123 Main St, Anytown',
    phone: '+1234567890',
    sell_date: '2024-02-15',
  },
  {
    id: 4,
    product_name: 'Generator',
    product_code: 'GEN-1000',
    batch_number: 'BATCH-004',
    purchase_date: '2024-02-25',
    quantity: 3,
    status: 'returned',
    return_reason: 'Defective unit',
  },
];

// List of dealers for admin view
const staticDealers: DealerSummary[] = [
  { id: 1, name: 'ABC Motors', total_available_stock: 12 },
  { id: 2, name: 'XYZ Equipment', total_available_stock: 8 },
  { id: 3, name: 'Fast Auto Parts', total_available_stock: 5 },
];

// Product details for each dealer (drill-down)
const dealerProductsMap: Record<number, StockItem[]> = {
  1: [
    {
      id: 101,
      product_name: 'High-Pressure Washer',
      product_code: 'HPW-2000',
      batch_number: 'BATCH-101',
      purchase_date: '2024-01-15',
      quantity: 5,
      status: 'available',
      dealer_name: 'ABC Motors',
    },
    {
      id: 102,
      product_name: 'Industrial Vacuum Cleaner',
      product_code: 'IVC-500',
      batch_number: 'BATCH-102',
      purchase_date: '2024-01-20',
      quantity: 3,
      status: 'available',
      dealer_name: 'ABC Motors',
    },
    {
      id: 103,
      product_name: 'Air Compressor',
      product_code: 'AC-3000',
      batch_number: 'BATCH-103',
      purchase_date: '2024-02-10',
      quantity: 2,
      status: 'sold',
      dealer_name: 'ABC Motors',
      customer_name: 'Jane Smith',
      customer_address: '456 Oak Ave, Somewhere',
      phone: '+9876543210',
      sell_date: '2024-02-20',
    },
    {
      id: 104,
      product_name: 'Generator',
      product_code: 'GEN-1000',
      batch_number: 'BATCH-104',
      purchase_date: '2024-02-25',
      quantity: 2,
      status: 'available',
      dealer_name: 'ABC Motors',
    },
  ],
  2: [
    {
      id: 201,
      product_name: 'High-Pressure Washer',
      product_code: 'HPW-2000',
      batch_number: 'BATCH-201',
      purchase_date: '2024-01-10',
      quantity: 3,
      status: 'available',
      dealer_name: 'XYZ Equipment',
    },
    {
      id: 202,
      product_name: 'Industrial Vacuum Cleaner',
      product_code: 'IVC-500',
      batch_number: 'BATCH-202',
      purchase_date: '2024-01-18',
      quantity: 4,
      status: 'returned',
      dealer_name: 'XYZ Equipment',
      return_reason: 'Customer changed mind',
    },
    {
      id: 203,
      product_name: 'Air Compressor',
      product_code: 'AC-3000',
      batch_number: 'BATCH-203',
      purchase_date: '2024-02-05',
      quantity: 1,
      status: 'sold',
      dealer_name: 'XYZ Equipment',
      customer_name: 'Bob Johnson',
      customer_address: '789 Pine Rd, Othertown',
      phone: '+1122334455',
      sell_date: '2024-02-12',
    },
  ],
  3: [
    {
      id: 301,
      product_name: 'Generator',
      product_code: 'GEN-1000',
      batch_number: 'BATCH-301',
      purchase_date: '2024-01-25',
      quantity: 5,
      status: 'available',
      dealer_name: 'Fast Auto Parts',
    },
  ],
};

// Purchase orders (static, can be modified locally)
let staticPurchaseOrders: PurchaseOrder[] = [
  {
    id: 1,
    dealer_id: 1,
    dealer_name: 'ABC Motors',
    item_name: 'High-Pressure Washer',
    item_code: 'HPW-2000',
    product_code: 'HPW-2000',
    order_quantity: 10,
    pending_quantity: 5,
    remarks: 'Urgent',
    order_date: '2024-03-01',
    status: 'partially_completed',
  },
  {
    id: 2,
    dealer_id: 2,
    dealer_name: 'XYZ Equipment',
    item_name: 'Industrial Vacuum Cleaner',
    item_code: 'IVC-500',
    product_code: 'IVC-500',
    order_quantity: 8,
    pending_quantity: 8,
    remarks: 'Standard',
    order_date: '2024-03-05',
    status: 'pending',
  },
  {
    id: 3,
    dealer_id: 3,
    dealer_name: 'Fast Auto Parts',
    item_name: 'Generator',
    item_code: 'GEN-1000',
    product_code: 'GEN-1000',
    order_quantity: 3,
    pending_quantity: 0,
    remarks: 'Completed',
    order_date: '2024-02-28',
    status: 'completed',
  },
];

// Helper for status badges
const getStatusBadge = (status: string) => {
  const variants: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    sold: 'bg-blue-100 text-blue-800',
    returned: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    partially_completed: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
  };
  const display = status === 'partially_completed' ? 'Partially Completed' : 
                   status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge className={variants[status] || 'bg-gray-100'}>
      {display}
    </Badge>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const DealerStock = () => {
  const { user: currentUser } = useAuth();

  // Role checks
  const isSystemAdmin = useMemo(() => currentUser?.role === UserRole.APPLICATION_ADMIN, [currentUser]);
  const isCompanyUser = useMemo(
    () => currentUser && [UserRole.COMPANY_ADMIN, UserRole.COMPANY_EMPLOYEE].includes(currentUser.role),
    [currentUser]
  );
  const isDealerUser = useMemo(
    () => currentUser && [UserRole.DEALER_ADMIN, UserRole.DEALER_EMPLOYEE].includes(currentUser.role),
    [currentUser]
  );
  const isAdmin = isSystemAdmin || isCompanyUser;

  // State for active tab
  const [activeTab, setActiveTab] = useState('stock');

  // ---------- Dealer Stock Tab State ----------
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [filteredStock, setFilteredStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true); // just for initial loading simulation

  // Admin dealer list
  const [dealers, setDealers] = useState<DealerSummary[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<DealerSummary | null>(null);
  const [dealerProducts, setDealerProducts] = useState<StockItem[]>([]);
  const [dealerProductsLoading, setDealerProductsLoading] = useState(false);
  const [dealerProductsDialogOpen, setDealerProductsDialogOpen] = useState(false);

  // Sell/Return dialogs
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [sellFormData, setSellFormData] = useState({
    customer_name: '',
    customer_address: '',
    phone: '',
    sell_date: '',
    bill_photo: null as File | null,
  });
  const [returnReason, setReturnReason] = useState('');

  // Search/filter for dealer stock
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Filters for dealer products drill-down
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminFilterDate, setAdminFilterDate] = useState('');
  const [adminFilterBatch, setAdminFilterBatch] = useState('');
  const [adminFilterStatus, setAdminFilterStatus] = useState<string>('all');

  // ---------- Purchase Order Tab State ----------
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [createOrderDialogOpen, setCreateOrderDialogOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({
    item_name: '',
    item_code: '',
    product_code: '',
    order_quantity: 0,
    remarks: '',
  });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Filters for purchase orders (admin only)
  const [poSearchTerm, setPoSearchTerm] = useState('');
  const [poFilterDealer, setPoFilterDealer] = useState<string>('all');
  const [poFilterItem, setPoFilterItem] = useState('');
  const [poFilterDate, setPoFilterDate] = useState('');
  const [poFilterStatus, setPoFilterStatus] = useState<string>('all');

  // ---------- Data initialisation (static) ----------
  useEffect(() => {
    // Simulate a short loading delay (optional)
    setTimeout(() => {
      if (isDealerUser) {
        setStockItems([...dealerOwnStock]);
        setFilteredStock([...dealerOwnStock]);
      } else if (isAdmin) {
        setDealers([...staticDealers]);
      }
      setLoading(false);
    }, 300);
  }, [isDealerUser, isAdmin]);

  useEffect(() => {
    if (activeTab === 'purchase-orders') {
      setPoLoading(true);
      // Simulate loading
      setTimeout(() => {
        setPurchaseOrders([...staticPurchaseOrders]);
        setFilteredOrders([...staticPurchaseOrders]);
        setPoLoading(false);
      }, 200);
    }
  }, [activeTab]);

  // Filter dealer stock
  useEffect(() => {
    if (!isDealerUser) return;
    let filtered = [...stockItems];
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.batch_number.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterDate) {
      filtered = filtered.filter((item) => item.purchase_date === filterDate);
    }
    if (filterBatch) {
      filtered = filtered.filter((item) => item.batch_number === filterBatch);
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter((item) => item.status === filterStatus);
    }
    setFilteredStock(filtered);
  }, [searchTerm, filterDate, filterBatch, filterStatus, stockItems, isDealerUser]);

  // Filter purchase orders (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    let filtered = [...purchaseOrders];
    if (poSearchTerm) {
      const term = poSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.dealer_name.toLowerCase().includes(term) ||
          order.item_name.toLowerCase().includes(term)
      );
    }
    if (poFilterDealer !== 'all') {
      filtered = filtered.filter((order) => order.dealer_id.toString() === poFilterDealer);
    }
    if (poFilterItem) {
      filtered = filtered.filter((order) =>
        order.item_name.toLowerCase().includes(poFilterItem.toLowerCase())
      );
    }
    if (poFilterDate) {
      filtered = filtered.filter((order) => order.order_date === poFilterDate);
    }
    if (poFilterStatus !== 'all') {
      filtered = filtered.filter((order) => order.status === poFilterStatus);
    }
    // Sort by order date descending (newest first)
    filtered.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
    setFilteredOrders(filtered);
  }, [purchaseOrders, poSearchTerm, poFilterDealer, poFilterItem, poFilterDate, poFilterStatus, isAdmin]);

  // Filter dealer products (drill-down)
  const filteredDealerProducts = useMemo(() => {
    let filtered = [...dealerProducts];
    if (adminSearchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.product_name.toLowerCase().includes(adminSearchTerm.toLowerCase()) ||
          item.product_code.toLowerCase().includes(adminSearchTerm.toLowerCase()) ||
          item.batch_number.toLowerCase().includes(adminSearchTerm.toLowerCase())
      );
    }
    if (adminFilterDate) {
      filtered = filtered.filter((item) => item.purchase_date === adminFilterDate);
    }
    if (adminFilterBatch) {
      filtered = filtered.filter((item) => item.batch_number === adminFilterBatch);
    }
    if (adminFilterStatus !== 'all') {
      filtered = filtered.filter((item) => item.status === adminFilterStatus);
    }
    return filtered;
  }, [dealerProducts, adminSearchTerm, adminFilterDate, adminFilterBatch, adminFilterStatus]);

  // ---------- Handlers ----------
  const handleSell = (product: StockItem) => {
    if (product.status !== 'available') {
      alert('Only available products can be sold.');
      return;
    }
    setSelectedProduct(product);
    setSellFormData({
      customer_name: '',
      customer_address: '',
      phone: '',
      sell_date: format(new Date(), 'yyyy-MM-dd'),
      bill_photo: null,
    });
    setSellDialogOpen(true);
  };

  const handleSellSubmit = () => {
    if (!selectedProduct) return;
    if (!sellFormData.customer_name || !sellFormData.customer_address || !sellFormData.phone || !sellFormData.sell_date) {
      alert('Please fill all required fields.');
      return;
    }
    // Update the stock item locally
    setStockItems(prev =>
      prev.map(item =>
        item.id === selectedProduct.id
          ? {
              ...item,
              status: 'sold',
              quantity: item.quantity - 1,
              customer_name: sellFormData.customer_name,
              customer_address: sellFormData.customer_address,
              phone: sellFormData.phone,
              sell_date: sellFormData.sell_date,
            }
          : item
      )
    );
    setSellDialogOpen(false);
    setSelectedProduct(null);
    alert('Product sold successfully!');
  };

  const handleReturn = (product: StockItem) => {
    if (product.status !== 'available') {
      alert('Only available products can be returned.');
      return;
    }
    setSelectedProduct(product);
    setReturnReason('');
    setReturnDialogOpen(true);
  };

  const handleReturnSubmit = () => {
    if (!selectedProduct) return;
    if (!returnReason.trim()) {
      alert('Please provide a return reason.');
      return;
    }
    setStockItems(prev =>
      prev.map(item =>
        item.id === selectedProduct.id
          ? {
              ...item,
              status: 'returned',
              quantity: item.quantity - 1,
              return_reason: returnReason,
            }
          : item
      )
    );
    setReturnDialogOpen(false);
    setSelectedProduct(null);
    alert('Product returned successfully!');
  };

  const handleDealerClick = (dealer: DealerSummary) => {
    setSelectedDealer(dealer);
    setDealerProductsLoading(true);
    setDealerProductsDialogOpen(true);
    // Simulate loading
    setTimeout(() => {
      const products = dealerProductsMap[dealer.id] || [];
      setDealerProducts(products.map(p => ({ ...p })));
      setDealerProductsLoading(false);
    }, 300);
  };

  // Purchase order handlers
  const handleCreateOrderClick = () => {
    setNewOrder({
      item_name: '',
      item_code: '',
      product_code: '',
      order_quantity: 0,
      remarks: '',
    });
    setCreateOrderDialogOpen(true);
  };

  const handleOrderSubmit = () => {
    if (!newOrder.item_name || !newOrder.item_code || !newOrder.product_code || newOrder.order_quantity <= 0) {
      alert('Please fill all required fields and ensure quantity is positive.');
      return;
    }
    setConfirmDialogOpen(true);
  };

  const confirmCreateOrder = () => {
    setConfirmDialogOpen(false);
    const newId = Math.max(...staticPurchaseOrders.map(o => o.id), 0) + 1;
    const dealerId = currentUser?.dealerId || 0;
    const dealerName = currentUser?.name || 'Unknown Dealer';
    const newOrderObj: PurchaseOrder = {
      id: newId,
      dealer_id: dealerId,
      dealer_name: dealerName,
      item_name: newOrder.item_name,
      item_code: newOrder.item_code,
      product_code: newOrder.product_code,
      order_quantity: newOrder.order_quantity,
      pending_quantity: newOrder.order_quantity,
      remarks: newOrder.remarks,
      order_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'pending',
    };
    staticPurchaseOrders.push(newOrderObj);
    setPurchaseOrders([...staticPurchaseOrders]);
    setCreateOrderDialogOpen(false);
    alert('Purchase Order Created Successfully');
  };

  const exportToCSV = () => {
    const headers = ['Dealer Name', 'Item Name', 'Item Code', 'Product Code', 'Order Quantity', 'Pending Quantity', 'Remarks', 'Order Date', 'Status'];
    const rows = filteredOrders.map(order => [
      order.dealer_name,
      order.item_name,
      order.item_code,
      order.product_code,
      order.order_quantity.toString(),
      order.pending_quantity.toString(),
      order.remarks,
      order.order_date,
      order.status,
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'purchase_orders.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper: product table render
  const renderProductTable = (items: StockItem[], showDealerName = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product Name</TableHead>
          <TableHead>Product Code</TableHead>
          <TableHead>Batch Number</TableHead>
          <TableHead>Purchase Date</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Status</TableHead>
          {showDealerName && <TableHead>Dealer</TableHead>}
          {isDealerUser && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showDealerName ? 7 : 6} className="text-center text-muted-foreground">
              No products found.
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.product_name}</TableCell>
              <TableCell>{item.product_code}</TableCell>
              <TableCell>{item.batch_number}</TableCell>
              <TableCell>{format(new Date(item.purchase_date), 'PPP')}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{getStatusBadge(item.status)}</TableCell>
              {showDealerName && <TableCell>{item.dealer_name || 'N/A'}</TableCell>}
              {isDealerUser && (
                <TableCell>
                  {item.status === 'available' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleSell(item)}>
                        <Truck className="h-3 w-3 mr-1" /> Sell
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReturn(item)}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Return
                      </Button>
                    </div>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  // Loading state (just visual)
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex-1 space-y-4 p-8 pt-6">
          <h2 className="text-3xl font-bold tracking-tight">Dealer Stock Management</h2>
          <Card>
            <CardContent className="p-4 text-center">Loading...</CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h2 className="text-3xl font-bold tracking-tight">Dealer Stock & Purchase Orders</h2>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="stock">Dealer Stock</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
          </TabsList>

          {/* Dealer Stock Tab */}
          <TabsContent value="stock" className="space-y-4">
            {isDealerUser ? (
              // Dealer View: Show own stock
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">My Stock</h3>
                  <Card className="w-64">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Total Available Stock</p>
                      <p className="text-2xl font-bold">
                        {stockItems.filter(i => i.status === 'available').reduce((s, i) => s + i.quantity, 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Stock Items</CardTitle>
                    <CardDescription>Manage your purchased products</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name, code, batch..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <Input
                        type="date"
                        placeholder="Purchase Date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                      />
                      <Input
                        placeholder="Batch Number"
                        value={filterBatch}
                        onChange={(e) => setFilterBatch(e.target.value)}
                      />
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                          <SelectItem value="returned">Returned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {renderProductTable(filteredStock, false)}
                  </CardContent>
                </Card>
              </>
            ) : isAdmin ? (
              // Admin View: Dealers list with drill-down
              <Card>
                <CardHeader>
                  <CardTitle>Dealers</CardTitle>
                  <CardDescription>List of all dealers with total available stock</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dealer Name</TableHead>
                        <TableHead>Total Available Stock</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No dealers found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dealers.map((dealer) => (
                          <TableRow key={dealer.id}>
                            <TableCell>{dealer.name}</TableCell>
                            <TableCell>{dealer.total_available_stock}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDealerClick(dealer)}
                              >
                                <Eye className="h-3 w-3 mr-1" /> View Products
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          {/* Purchase Orders Tab */}
          <TabsContent value="purchase-orders" className="space-y-4">
            {isDealerUser ? (
              // Dealer view: single button + list of their orders
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold">My Purchase Orders</h3>
                  <Button onClick={handleCreateOrderClick}>
                    <Plus className="h-4 w-4 mr-2" /> Create Purchase Order
                  </Button>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Purchase Orders</CardTitle>
                    <CardDescription>List of orders you have placed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {poLoading ? (
                      <div className="py-8 text-center">Loading orders...</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Dealer Name</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>Item Code</TableHead>
                            <TableHead>Product Code</TableHead>
                            <TableHead>Order Quantity</TableHead>
                            <TableHead>Pending Quantity</TableHead>
                            <TableHead>Remarks</TableHead>
                            <TableHead>Order Date</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {purchaseOrders.filter(o => o.dealer_id === (currentUser?.dealerId || 0)).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center text-muted-foreground">
                                No purchase orders found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            purchaseOrders
                              .filter(o => o.dealer_id === (currentUser?.dealerId || 0))
                              .map((order) => (
                                <TableRow key={order.id}>
                                  <TableCell>{order.dealer_name}</TableCell>
                                  <TableCell>{order.item_name}</TableCell>
                                  <TableCell>{order.item_code}</TableCell>
                                  <TableCell>{order.product_code}</TableCell>
                                  <TableCell>{order.order_quantity}</TableCell>
                                  <TableCell>{order.pending_quantity}</TableCell>
                                  <TableCell>{order.remarks}</TableCell>
                                  <TableCell>{format(new Date(order.order_date), 'PPP')}</TableCell>
                                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : isAdmin ? (
              // Admin view: all orders with filters and export
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold">Purchase Orders</h3>
                  <Button variant="outline" onClick={exportToCSV}>
                    <Download className="h-4 w-4 mr-2" /> Export to CSV
                  </Button>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>All Purchase Orders</CardTitle>
                    <CardDescription>View and manage purchase orders from dealers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by dealer or item..."
                          value={poSearchTerm}
                          onChange={(e) => setPoSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <Select value={poFilterDealer} onValueChange={setPoFilterDealer}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Dealers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Dealers</SelectItem>
                          {dealers.map(d => (
                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Item name"
                        value={poFilterItem}
                        onChange={(e) => setPoFilterItem(e.target.value)}
                      />
                      <Input
                        type="date"
                        placeholder="Order Date"
                        value={poFilterDate}
                        onChange={(e) => setPoFilterDate(e.target.value)}
                      />
                      <Select value={poFilterStatus} onValueChange={setPoFilterStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="partially_completed">Partially Completed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {poLoading ? (
                      <div className="py-8 text-center">Loading orders...</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Dealer Name</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>Item Code</TableHead>
                            <TableHead>Product Code</TableHead>
                            <TableHead>Order Quantity</TableHead>
                            <TableHead>Pending Quantity</TableHead>
                            <TableHead>Remarks</TableHead>
                            <TableHead>Order Date</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOrders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center text-muted-foreground">
                                No purchase orders found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredOrders.map((order) => (
                              <TableRow key={order.id}>
                                <TableCell>{order.dealer_name}</TableCell>
                                <TableCell>{order.item_name}</TableCell>
                                <TableCell>{order.item_code}</TableCell>
                                <TableCell>{order.product_code}</TableCell>
                                <TableCell>{order.order_quantity}</TableCell>
                                <TableCell>{order.pending_quantity}</TableCell>
                                <TableCell>{order.remarks}</TableCell>
                                <TableCell>{format(new Date(order.order_date), 'PPP')}</TableCell>
                                <TableCell>{getStatusBadge(order.status)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        </Tabs>

        {/* Dialogs for Sell/Return */}
        <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Sell Product</DialogTitle>
              <DialogDescription>
                Enter customer details to sell {selectedProduct?.product_name} (Batch: {selectedProduct?.batch_number})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer_name" className="text-right">Customer Name *</Label>
                <Input
                  id="customer_name"
                  value={sellFormData.customer_name}
                  onChange={(e) => setSellFormData({ ...sellFormData, customer_name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer_address" className="text-right">Address *</Label>
                <Textarea
                  id="customer_address"
                  value={sellFormData.customer_address}
                  onChange={(e) => setSellFormData({ ...sellFormData, customer_address: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Phone *</Label>
                <Input
                  id="phone"
                  value={sellFormData.phone}
                  onChange={(e) => setSellFormData({ ...sellFormData, phone: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sell_date" className="text-right">Sell Date *</Label>
                <Input
                  id="sell_date"
                  type="date"
                  value={sellFormData.sell_date}
                  onChange={(e) => setSellFormData({ ...sellFormData, sell_date: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bill_photo" className="text-right">Bill Photo</Label>
                <Input
                  id="bill_photo"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setSellFormData({ ...sellFormData, bill_photo: e.target.files?.[0] || null })}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSellDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSellSubmit}>Confirm Sale</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Return Product</DialogTitle>
              <DialogDescription>
                Provide a reason for returning {selectedProduct?.product_name} (Batch: {selectedProduct?.batch_number})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="return_reason" className="text-right">Reason *</Label>
                <Textarea
                  id="return_reason"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="col-span-3"
                  placeholder="Why are you returning this product?"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleReturnSubmit}>Confirm Return</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Drill-down dialog for admin */}
        <Dialog open={dealerProductsDialogOpen} onOpenChange={setDealerProductsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Products of {selectedDealer?.name}</DialogTitle>
              <DialogDescription>View all stock items for this dealer</DialogDescription>
            </DialogHeader>
            {dealerProductsLoading ? (
              <div className="py-8 text-center">Loading products...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, code, batch..."
                      value={adminSearchTerm}
                      onChange={(e) => setAdminSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Input
                    type="date"
                    placeholder="Purchase Date"
                    value={adminFilterDate}
                    onChange={(e) => setAdminFilterDate(e.target.value)}
                  />
                  <Input
                    placeholder="Batch Number"
                    value={adminFilterBatch}
                    onChange={(e) => setAdminFilterBatch(e.target.value)}
                  />
                  <Select value={adminFilterStatus} onValueChange={setAdminFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {renderProductTable(filteredDealerProducts, false)}
              </>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDealerProductsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Order Dialog */}
        <Dialog open={createOrderDialogOpen} onOpenChange={setCreateOrderDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
              <DialogDescription>Fill in the details for your order</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="po_item_name">Item Name *</Label>
                <Input
                  id="po_item_name"
                  value={newOrder.item_name}
                  onChange={(e) => setNewOrder({ ...newOrder, item_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="po_item_code">Item Code *</Label>
                <Input
                  id="po_item_code"
                  value={newOrder.item_code}
                  onChange={(e) => setNewOrder({ ...newOrder, item_code: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="po_product_code">Product Code *</Label>
                <Input
                  id="po_product_code"
                  value={newOrder.product_code}
                  onChange={(e) => setNewOrder({ ...newOrder, product_code: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="po_quantity">Order Quantity *</Label>
                <Input
                  id="po_quantity"
                  type="number"
                  value={newOrder.order_quantity || ''}
                  onChange={(e) => setNewOrder({ ...newOrder, order_quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="po_remarks">Remarks</Label>
                <Textarea
                  id="po_remarks"
                  value={newOrder.remarks}
                  onChange={(e) => setNewOrder({ ...newOrder, remarks: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOrderDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleOrderSubmit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Confirm Order</DialogTitle>
              <DialogDescription>
                Are you sure you want to save this purchase order?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
              <Button onClick={confirmCreateOrder}>OK</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default DealerStock;