import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { CheckCircle2, AlertTriangle, Upload, X as Close, Search } from "lucide-react";
import { UserRole } from "@/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
const API_URL = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png"];

type FormData = {
  installationDate: string;
  installedBy: string;
  clientCompanyName: string;
  clientGstNumber: string;
  clientContactPerson: string;
  clientContactPhone: string;
  location: string;
  notes: string;
  itemName: string;
  itemCode: string;
  batchNumber: string;
  invoiceNumber: string;
  purchaseDate: string;
};

export default function MachineInstallation() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const allowedRoles: UserRole[] = [
    UserRole.COMPANY_EMPLOYEE,
    UserRole.COMPANY_ADMIN,
    UserRole.DEALER_EMPLOYEE,
    UserRole.DEALER_ADMIN,
    UserRole.SYSTEM_ADMIN,
  ];
  const canAccess = allowedRoles.includes(user?.role as UserRole);

  const [isSubmitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [batchInput, setBatchInput] = useState<string>("");
  const [detailsFetched, setDetailsFetched] = useState(false);

  const [form, setForm] = useState<FormData>({
    installationDate: new Date().toISOString().split("T")[0],
    installedBy: user?.name ?? "Unknown Installer",
    clientCompanyName: "",
    clientGstNumber: "",
    clientContactPerson: "",
    clientContactPhone: "",
    location: "",
    notes: "",
    itemName: "",
    itemCode: "",
    batchNumber: "",
    invoiceNumber: "",
    purchaseDate: "",
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [e.target.name]: e.target.value })),
    []
  );

  useEffect(() => {
    if (detailsFetched && batchInput !== form.batchNumber) {
      setDetailsFetched(false);
      setForm((prev) => ({
        ...prev,
        itemName: "",
        itemCode: "",
        invoiceNumber: "",
        purchaseDate: "",
      }));
    }
  }, [batchInput, detailsFetched, form.batchNumber]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const accepted: File[] = [];

    files.forEach((f) => {
      const isTypeValid = ALLOWED_FILE_TYPES.includes(f.type);
      const isSizeValid = f.size <= MAX_SIZE;
      const isDuplicate = photos.some((p) => p.name === f.name && p.size === f.size);
      if (isTypeValid && isSizeValid && !isDuplicate) accepted.push(f);
    });

    if (accepted.length !== files.length) {
      toast({
        title: "Invalid file(s)",
        description: "Only JPEG/PNG up to 5 MB are allowed and no duplicates",
        variant: "destructive",
      });
    }
    setPhotos((prev) => [...prev, ...accepted]);
  };

  const removePhoto = useCallback(
    (index: number) => setPhotos((prev) => prev.filter((_, idx) => idx !== index)),
    []
  );

  const fetchMachineDetails = useCallback(async () => {
    if (!batchInput) {
      toast({ title: "Missing Batch Number", description: "Enter batch number.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const url = `${API_URL}/installations/get-details-by-batch/?batch=${encodeURIComponent(batchInput)}`;
      const res = await fetch(url, {
        headers: user?.token ? {'Authorization': `Token ${user?.token}`,} : undefined,
      });

      if (!res.ok) throw new Error("Could not fetch machine details.");
      const data = await res.json();

      if (!data) {
        toast({ title: "Not Found", description: "No machine found.", variant: "destructive" });
        setDetailsFetched(false);
        return;
      }

      // GST validation
      const machineGST = data.gst_no || data.dealer_gst || data.supplier_gst || "";
      if (
        (user?.role === UserRole.DEALER_ADMIN || user?.role === UserRole.DEALER_EMPLOYEE) &&
        user?.gstNumber &&
        machineGST !== user.gstNumber
      ) {
        toast({
          title: "GST Mismatch",
          description: `Machine GST: ${machineGST}, Your GST: ${user.gstNumber}`,
          variant: "destructive",
        });
        setDetailsFetched(false);
        return;
      }

      // fill fields
      setForm((prev) => ({
        ...prev,
        itemName: data.item_name || "",
        itemCode: data.item_code || "",
        batchNumber: batchInput,
        invoiceNumber: data.invoice_number || "",
        purchaseDate: data.purchase_date ? new Date(data.purchase_date).toISOString().split("T")[0] : "",
      }));
      setDetailsFetched(true);
      toast({ title: "Success", description: "Machine details fetched." });
    } catch (error: any) {
      toast({ title: "Fetch Error", description: error.message, variant: "destructive" });
      setDetailsFetched(false);
    } finally {
      setSubmitting(false);
    }
  }, [batchInput, user?.token, user?.gstNumber, user?.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requiredFields = {
      clientCompanyName: "Client Company Name",
      clientGstNumber: "Client GST Number",
      clientContactPerson: "Contact Person",
      clientContactPhone: "Contact Phone",
      batchNumber: "Batch Number",
      location: "Installation location",
    };
    const missingField = Object.entries(requiredFields).find(([f]) => !form[f as keyof FormData]);
    if (missingField) {
      toast({ title: "Error", description: `${missingField[1]} is required`, variant: "destructive" });
      return;
    }

    if (!window.confirm("Submit installation details?")) return;

    setSubmitting(true);
    const fd = new FormData();
    fd.append("installation_date", form.installationDate);
    fd.append("installed_by", form.installedBy);
    fd.append("location", form.location);
    fd.append("notes", form.notes);
    fd.append("client_company_name", form.clientCompanyName);
    fd.append("client_gst_number", form.clientGstNumber);
    fd.append("client_contact_person", form.clientContactPerson);
    fd.append("client_contact_phone", form.clientContactPhone);
    fd.append("batch_number", form.batchNumber);
    fd.append("invoice_number", form.invoiceNumber);
    fd.append("purchase_date", form.purchaseDate);

    if (user?.companyId) fd.append("company", String(user.companyId));
    if (user?.dealerId) fd.append("dealer", String(user.dealerId));

    fd.append("submitted_by_id", String(user?.id));
    fd.append("submitted_by_name", user?.name ?? "");
    fd.append("submitted_by_role", user?.role ?? "");
    photos.forEach((p) => fd.append("photo_files", p));

    try {
      const res = await fetch(`${API_URL}/installations/create/`, {
        method: "POST",
        headers: user?.token ? { Authorization: `Token ${user.token}` } : undefined,
        body: fd,
      });
      if (!res.ok) throw new Error("Failed to submit installation");

      toast({ title: "Success", description: "Installation saved successfully" });
      navigate("/machines");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only authorized roles can access this form.</p>
          <p className="text-sm mt-2">Your role: <span className="font-medium">{user?.role}</span></p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Machine Installation Form
              {detailsFetched && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            </CardTitle>
            <CardDescription>Record a new machine installation at the client site.</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Batch Number Lookup */}
              <div className="border-b pb-4 space-y-4">
                <h3 className="font-medium">Machine Verification</h3>
                <div className="flex items-end gap-4">
                  <div className="flex-grow space-y-2">
                    <Label htmlFor="batchInput">Batch Number *</Label>
                    <Input
                      id="batchInput"
                      name="batchInput"
                      value={batchInput}
                      onChange={(e) => setBatchInput(e.target.value)}
                      disabled={isSubmitting}
                      required
                      placeholder="Enter machine batch number"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={fetchMachineDetails}
                    disabled={isSubmitting || !batchInput}
                    className="flex items-center gap-2"
                  >
                    <Search className="h-4 w-4" /> Get Details
                  </Button>
                </div>
                {detailsFetched && (
                  <p className="text-sm text-green-600 flex items-center gap-1 mt-2">
                    <CheckCircle2 className="h-4 w-4" /> Details fetched for batch:{" "}
                    <span className="font-semibold">{form.batchNumber}</span>
                  </p>
                )}
              </div>

              {/* Machine Details */}
              <div className="border-b pb-4 space-y-4">
                <h3 className="font-medium">Machine Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="itemName">Item Name</Label>
                    <Input
                      id="itemName"
                      name="itemName"
                      value={form.itemName}
                      disabled
                      placeholder="Auto-filled after batch lookup"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="itemCode">Item Code</Label>
                    <Input
                      id="itemCode"
                      name="itemCode"
                      value={form.itemCode}
                      disabled
                      placeholder="Auto-filled after batch lookup"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">Invoice Number</Label>
                    <Input
                      id="invoiceNumber"
                      name="invoiceNumber"
                      value={form.invoiceNumber}
                      disabled
                      placeholder="Auto-filled after batch lookup"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <Input
                      id="purchaseDate"
                      name="purchaseDate"
                      type="date"
                      value={form.purchaseDate}
                      disabled
                      placeholder="Auto-filled after batch lookup"
                    />
                  </div>
                </div>
              </div>

              {/* Client Information */}
              <div className="border-b pb-4 space-y-4">
                <h3 className="font-medium">Client Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientCompanyName">Client Company Name *</Label>
                    <Input
                      id="clientCompanyName"
                      name="clientCompanyName"
                      value={form.clientCompanyName}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientGstNumber">Client GST Number *</Label>
                    <Input
                      id="clientGstNumber"
                      name="clientGstNumber"
                      value={form.clientGstNumber}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientContactPerson">Contact Person *</Label>
                    <Input
                      id="clientContactPerson"
                      name="clientContactPerson"
                      value={form.clientContactPerson}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientContactPhone">Contact Phone *</Label>
                    <Input
                      id="clientContactPhone"
                      name="clientContactPhone"
                      value={form.clientContactPhone}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Installation Details */}
              <div className="border-b pb-4 space-y-4">
                <h3 className="font-medium">Installation Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="installationDate">Installation Date *</Label>
                    <Input
                      id="installationDate"
                      name="installationDate"
                      type="date"
                      value={form.installationDate}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="installedBy">Installed By *</Label>
                    <Input id="installedBy" name="installedBy" value={form.installedBy} disabled />
                    <p className="text-xs text-muted-foreground">Auto-filled with your name</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Installation Address *</Label>
                  <Textarea
                    id="location"
                    name="location"
                    rows={3}
                    value={form.location}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              {/* Photos upload */}
              <div className="space-y-2">
                <Label>Installation Photos (JPEG/PNG ≤ 5 MB each)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-3">Upload installation photos</p>
                  <input
                    id="photos"
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={isSubmitting}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("photos")?.click()}
                    disabled={isSubmitting}
                  >
                    Choose Photos
                  </Button>

                  {photos.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {photos.map((p, idx) => (
                        <div key={idx} className="relative bg-gray-100 rounded p-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate max-w-[140px]" title={p.name}>
                              {p.name}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removePhoto(idx)}
                              disabled={isSubmitting}
                            >
                              <Close className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  value={form.notes}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => navigate("/machines")}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !detailsFetched}>
                {isSubmitting ? "Submitting..." : "Submit Installation"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
