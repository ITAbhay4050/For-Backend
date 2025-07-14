import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { Machine, UserRole } from "@/types";

/* ----- UI ----- */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

/* ----- Constants ----- */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const API_URL = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

/* -------------------------------------------------------------------------- */
/*                            Machines list component                         */
/* -------------------------------------------------------------------------- */
const Machines = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /* ----------------------------- Permissions ------------------------------ */
  const canAddMachine =
    user?.role === UserRole.APPLICATION_ADMIN ||
    user?.role === UserRole.COMPANY_ADMIN;

  /* ---------------------------- Image helper ------------------------------ */
  const getImageUrl = (photoPath: string) => {
    if (!photoPath) return '';
    if (photoPath.startsWith("http")) return photoPath;
    return `${API_URL}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`;
  };

  /* ----------------------------- Data fetch ------------------------------- */
  const fetchMachines = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/installations/`, {
        headers: user?.token ? { Authorization: `Token ${user.token}` } : undefined,
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch machines: ${res.status}`);
      }

      const data = await res.json();
      setMachines(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching machines:", error);
      toast({
        title: "Error",
        description: "Failed to load machines. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, [user?.token]);

  /* --------------------------- Derived list ------------------------------- */
  const filteredMachines = machines.filter((m) => {
    if (!m) return false;
    const q = searchTerm.toLowerCase();
    return (
      m.model_number?.toLowerCase().includes(q) ||
      m.serial_number?.toLowerCase().includes(q) ||
      m.location?.toLowerCase().includes(q)
    );
  });

  /* ----------------------------- JSX -------------------------------------- */
  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* ---- Header bar ---- */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-3xl font-bold tracking-tight">Machines</h2>

          <Button
            onClick={() => navigate("/machine-installation")}
            disabled={!canAddMachine}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            New Installation
          </Button>
        </div>

        {/* ---- Card ---- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Machine Inventory</CardTitle>
          </CardHeader>

          <CardContent>
            {/* ---- Search ---- */}
            <div className="relative w-full sm:w-80 mb-6">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search machines..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* ---- Loading state ---- */}
            {isLoading && (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            )}

            {/* ---- Table ---- */}
            {!isLoading && (
              <div className="rounded-md border">
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="border-b">
                      <tr className="border-b">
                        <th className="h-12 px-4 text-left">Photo</th>
                        <th className="h-12 px-4 text-left">Model</th>
                        <th className="h-12 px-4 text-left">Serial #</th>
                        <th className="h-12 px-4 text-left">Location</th>
                        <th className="h-12 px-4 text-left">Install Date</th>
                        <th className="h-12 px-4 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredMachines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-4 text-center text-muted-foreground"
                          >
                            {machines.length === 0 
                              ? "No machines found in the system" 
                              : "No machines match your search"}
                          </td>
                        </tr>
                      ) : (
                        filteredMachines.map((machine) => (
                          <tr
                            key={machine.id}
                            className="border-b hover:bg-muted/50 cursor-pointer"
                            onClick={() => navigate(`/machines/${machine.id}`)}
                          >
                            {/* ---- Photo cell ---- */}
                            <td className="p-4">
                              {machine.photos?.length > 0 ? (
                                <img
                                  src={getImageUrl(machine.photos[0].photo)}
                                  alt="Machine"
                                  className="w-14 h-14 object-cover rounded-lg border"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/56';
                                  }}
                                />
                              ) : (
                                <div className="w-14 h-14 flex items-center justify-center bg-gray-100 text-xs rounded-lg text-muted-foreground">
                                  No Image
                                </div>
                              )}
                            </td>

                            {/* ---- Other cells ---- */}
                            <td className="p-4">{machine.model_number || "N/A"}</td>
                            <td className="p-4">{machine.serial_number || "N/A"}</td>
                            <td className="p-4">{machine.location || "N/A"}</td>
                            <td className="p-4">{machine.installation_date || "—"}</td>

                            {/* ---- Action ---- */}
                            <td className="p-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/machines/${machine.id}`);
                                }}
                              >
                                View
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Machines;