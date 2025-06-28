import { useState } from "react";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  Card, CardContent, CardDescription, CardFooter,
  CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { UserRole } from "@/types";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Upload, X } from "lucide-react";
import PurchaseVerification from "@/components/MachineInstallation/PurchaseVerification";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type PurchasedMachine = {
  id: string;
  model: string;
  serialNumber: string;
  batchNumber: string;
  invoiceNumber: string;
  purchaseDate: string;
  isInstalled: boolean;
  dealerId: string;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function MachineInstallation() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // RBAC ----------------------------------------------------------------------
  const allowedRoles: UserRole[] = [
    UserRole.COMPANY_EMPLOYEE,
    UserRole.COMPANY_ADMIN,
    UserRole.DEALER_EMPLOYEE,
    UserRole.DEALER_ADMIN,
  ];
  const canAccess = allowedRoles.includes(user?.role as UserRole);
  const isDealerSide =
    user?.role === UserRole.DEALER_EMPLOYEE ||
    user?.role === UserRole.DEALER_ADMIN;

  // State ---------------------------------------------------------------------
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<PurchasedMachine | null>(null);
  const [formData, setFormData] = useState({
    installationDate: new Date().toISOString().split("T")[0],
    installedBy: user?.name || "Unknown Installer",
    // Company‑side (client) info
    clientCompanyName: "",
    clientGstNumber: "",
    clientContactPerson: "",
    clientContactPhone: "",
    // Machine info (company side)
    modelNumber: "",
    serialNumber: "",
    // Shared
    location: "",
    notes: "",
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => ["image/jpeg", "image/png"].includes(f.type));
    if (valid.length !== files.length) {
      toast({
        title: "Warning",
        description: "Only JPEG and PNG files are allowed",
        variant: "destructive",
      });
    }
    setPhotos((prev) => [...prev, ...valid]);
  };

  const removePhoto = (idx: number) =>
    setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const handleMachineSelected = (machine: PurchasedMachine) =>
    setSelectedMachine(machine);

  const validateUniqueSerialNumber = async (serial: string) => {
    /* TODO: hit an API to ensure uniqueness on server side.
       For now always returns true. */
    return true;
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Dealer-side must select machine
  if (isDealerSide && !selectedMachine) {
    toast({
      title: "Error",
      description: "Please select a machine from your purchase records",
      variant: "destructive",
    });
    return;
  }

  // Company‑side required fields
  if (!isDealerSide) {
    const requiredFields = [
      "clientCompanyName",
      "clientGstNumber",
      "clientContactPerson",
      "clientContactPhone",
      "modelNumber",
      "serialNumber",
    ];
    const empty = requiredFields.find(
      (f) => !formData[f as keyof typeof formData]
    );
    if (empty) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }
    if (!(await validateUniqueSerialNumber(formData.serialNumber))) {
      toast({
        title: "Error",
        description: "Machine serial number already exists",
        variant: "destructive",
      });
      return;
    }
  }

  if (!formData.location) {
    toast({
      title: "Error",
      description: "Please provide installation location",
      variant: "destructive",
    });
    return;
  }

  // Extra user field validation
  if (!user?.id || !user?.name || !user?.role) {
    toast({
      title: "Error",
      description: "User details missing. Please re-login.",
      variant: "destructive",
    });
    return;
  }

  // Start submitting
  setIsSubmitting(true);

  // Prepare form data
  const fd = new FormData();
  fd.append("installation_date", formData.installationDate);
  fd.append("installed_by", formData.installedBy);
  fd.append("location", formData.location);
  fd.append("notes", formData.notes);

  // Company-side machine and client info
  if (!isDealerSide) {
    fd.append("client_company_name", formData.clientCompanyName);
    fd.append("client_gst_number", formData.clientGstNumber);
    fd.append("client_contact_person", formData.clientContactPerson);
    fd.append("client_contact_phone", formData.clientContactPhone);
    fd.append("model_number", formData.modelNumber);
    fd.append("serial_number", formData.serialNumber);
  }

  // Dealer-side machine details
  if (isDealerSide && selectedMachine) {
    fd.append("model_number", selectedMachine.model);
    fd.append("serial_number", selectedMachine.serialNumber);
    fd.append("batch_number", selectedMachine.batchNumber);
    fd.append("invoice_number", selectedMachine.invoiceNumber);
  }

  // Set company or dealer foreign keys
  if (user?.companyId) fd.append("company", String(user.companyId));
  if (user?.dealerId) fd.append("dealer", String(user.dealerId));

  // Required user info
  fd.append("submitted_by_id", String(user.id));
  fd.append("submitted_by_name", user.name);
  fd.append("submitted_by_role", user.role);

  // Attach photos
  photos.forEach((photo) => fd.append("photos", photo));

  // API Request
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"}/api/installations/create/`,
      {
        method: "POST",
        body: fd,
      }
    );

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Failed");
    }

    toast({
      title: "Success",
      description: "Installation record saved successfully",
    });
    navigate("/machines");
  } catch (err) {
    console.error(err);
    toast({
      title: "Error",
      description: "Something went wrong while saving",
      variant: "destructive",
    });
  } finally {
    setIsSubmitting(false);
  }
};


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Only authorised roles can access this form.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Your current role: <span className="font-medium">{user?.role}</span>
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Dealer-side purchase verification */}
        {isDealerSide && (
          <PurchaseVerification
            onMachineSelected={handleMachineSelected}
            selectedMachine={selectedMachine}
          />
        )}

        {/* Installation form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Machine Installation Form
              {(selectedMachine || !isDealerSide) && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
            </CardTitle>
            <CardDescription>
              {isDealerSide
                ? "Complete installation details for the selected machine from purchase records"
                : "Record a new machine installation at client site"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Machine Details block (company side) */}
              {!isDealerSide && (
                <div className="border-b pb-4 space-y-4">
                  <h3 className="font-medium">Machine Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="modelNumber">Model Number *</Label>
                      <Input
                        id="modelNumber"
                        name="modelNumber"
                        value={formData.modelNumber}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serialNumber">Serial Number *</Label>
                      <Input
                        id="serialNumber"
                        name="serialNumber"
                        value={formData.serialNumber}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Client info (company side) */}
              {!isDealerSide && (
                <div className="border-b pb-4 space-y-4">
                  <h3 className="font-medium">Client Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientCompanyName">
                        Client Company Name *
                      </Label>
                      <Input
                        id="clientCompanyName"
                        name="clientCompanyName"
                        value={formData.clientCompanyName}
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
                        value={formData.clientGstNumber}
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
                        value={formData.clientContactPerson}
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
                        value={formData.clientContactPhone}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Shared fields */}
              <div className="border-b pb-4 space-y-4">
                <h3 className="font-medium">Installation Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="installationDate">
                      Installation Date *
                    </Label>
                    <Input
                      id="installationDate"
                      name="installationDate"
                      type="date"
                      value={formData.installationDate}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="installedBy">Installed By *</Label>
                    <Input
                      id="installedBy"
                      name="installedBy"
                      value={formData.installedBy}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto‑filled with your name
                    </p>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Installation Address *</Label>
                  <Textarea
                    id="location"
                    name="location"
                    rows={3}
                    placeholder="Enter full installation address..."
                    value={formData.location}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              {/* Photos */}
              <div className="space-y-2">
                <Label htmlFor="photos">Installation Photos (JPEG/PNG)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <div className="text-center">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      Upload installation photos
                    </p>
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
                  </div>

                  {photos.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {photos.map((p, idx) => (
                        <div key={idx} className="relative bg-gray-100 rounded p-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate max-w-[140px]">{p.name}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSubmitting}
                              onClick={() => removePhoto(idx)}
                            >
                              <X className="h-4 w-4" />
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
                  placeholder="Any additional observations..."
                  value={formData.notes}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
             <Button
  type="submit"
  // 🔧 Dealer machine selection disable condition temporarily commented
  disabled={
    isSubmitting
    // || (isDealerSide && !selectedMachine)
  }
>
  {isSubmitting ? "Submitting..." : "Submit Installation"}
</Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
