import { useState } from "react";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { Task, UserRole } from "@/types";

/* ---------- UI components (split imports) ---------- */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  FilterIcon,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const generateId = () => Date.now().toString();

/** Priority badge */
const PriorityBadge = ({ p }: { p: Task["priority"] }) => {
  const map: Record<Task["priority"], string> = {
    low: "bg-blue-100 text-blue-800 border-blue-300",
    medium: "bg-green-100 text-green-800 border-green-300",
    high: "bg-orange-100 text-orange-800 border-orange-300",
    urgent: "bg-red-100 text-red-800 border-red-300",
  };
  return <Badge className={map[p]}>{p[0].toUpperCase() + p.slice(1)}</Badge>;
};

/** Status badge */
const StatusBadge = ({ s }: { s: Task["status"] }) => {
  switch (s) {
    case "pending":
      return (
        <Badge
          variant="outline"
          className="flex items-center gap-1 bg-amber-100 text-amber-800 border-amber-300"
        >
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case "in-progress":
      return (
        <Badge
          variant="outline"
          className="flex items-center gap-1 bg-blue-100 text-blue-800 border-blue-300"
        >
          <AlertTriangle className="h-3 w-3" />
          In&nbsp;Progress
        </Badge>
      );
    case "completed":
      return (
        <Badge
          variant="outline"
          className="flex items-center gap-1 bg-green-100 text-green-800 border-green-300"
        >
          <CheckCircle className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge
          variant="outline"
          className="flex items-center gap-1 bg-red-100 text-red-800 border-red-300"
        >
          <XCircle className="h-3 w-3" />
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const Tasks = () => {
  const { user } = useAuth();

  /* ------------------------- state ------------------------- */
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      title: "Install CLX-5000 at Client HQ",
      description: "New machine installation at client headquarters",
      createdAt: "2023-05-10",
      deadline: "2023-05-15",
      priority: "high",
      status: "completed",
      assignerId: "2",
      assigneeId: "3",
      machineId: "1",
    },
    {
      id: "2",
      title: "Verify RVX-300 installation",
      description: "Perform quality check on recent installation",
      createdAt: "2023-06-18",
      deadline: "2023-06-22",
      priority: "medium",
      status: "completed",
      assignerId: "2",
      assigneeId: "3",
      machineId: "2",
    },
    {
      id: "3",
      title: "Prepare site for CLX-6000 installation",
      description: "Visit client site and ensure all requirements are met",
      createdAt: "2023-07-01",
      deadline: "2023-07-10",
      priority: "low",
      status: "pending",
      assignerId: "4",
      assigneeId: "5",
      machineId: "3",
    },
    {
      id: "4",
      title: "Repair RVX-200 cooling system",
      description: "Client reported overheating issues",
      createdAt: "2023-04-05",
      deadline: "2023-04-10",
      priority: "urgent",
      status: "in-progress",
      assignerId: "2",
      assigneeId: "3",
      machineId: "4",
    },
  ]);

  const [searchTerm, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Task>>({
    title: "",
    description: "",
    deadline: new Date().toISOString().split("T")[0],
    priority: "medium",
    status: "pending",
    assignerId: user?.id,
  });

  /* --------------------- permissions --------------------- */
  const canAssign =
    user?.role === UserRole.APPLICATION_ADMIN ||
    user?.role === UserRole.COMPANY_ADMIN ||
    user?.role === UserRole.DEALER_ADMIN ||
    user?.role === UserRole.COMPANY_EMPLOYEE;

  /* --------------------- filtering ----------------------- */
  const visibleTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? t.status === statusFilter : true;

    if (
      user?.role === UserRole.COMPANY_EMPLOYEE ||
      user?.role === UserRole.DEALER_EMPLOYEE
    ) {
      return matchesSearch && matchesStatus && t.assigneeId === user.id;
    }
    if (user?.role === UserRole.DEALER_ADMIN) {
      return (
        matchesSearch &&
        matchesStatus &&
        (t.assignerId === user.id || t.assigneeId === user.id)
      );
    }
    return matchesSearch && matchesStatus;
  });

  /* -------------------- create task ---------------------- */
  const handleCreate = () => {
    if (!draft.title || !draft.description || !draft.assigneeId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    const newTask: Task = {
      ...(draft as Task),
      id: generateId(),
      createdAt: new Date().toISOString().split("T")[0],
    };
    setTasks((prev) => [...prev, newTask]);
    toast({ title: "Success", description: "Task created." });
    setDialogOpen(false);
    setDraft({
      title: "",
      description: "",
      deadline: new Date().toISOString().split("T")[0],
      priority: "medium",
      status: "pending",
      assignerId: user?.id,
    });
  };

  /* ------------------------- JSX ------------------------- */
  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* header row */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <h2 className="text-3xl font-bold">Tasks</h2>
          <Button
            disabled={!canAssign}
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </Button>
        </div>

        {/* card */}
        <Card>
          <CardHeader>
            <CardTitle>Task Management</CardTitle>
          </CardHeader>
          <CardContent>
            {/* filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <FilterIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Filter:</span>
                {["All", "pending", "in-progress", "completed"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={
                      statusFilter === (s === "All" ? null : s)
                        ? "secondary"
                        : "outline"
                    }
                    onClick={() =>
                      setStatusFilter(s === "All" ? null : (s as any))
                    }
                  >
                    {s[0].toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* table */}
            <div className="rounded-md border overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Deadline</th>
                    <th className="px-4 py-3 text-left">Priority</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No tasks found
                      </td>
                    </tr>
                  ) : (
                    visibleTasks.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.description}
                          </p>
                        </td>
                        <td className="px-4 py-3">{t.deadline}</td>
                        <td className="px-4 py-3">
                          <PriorityBadge p={t.priority} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge s={t.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Assign a task to a company or dealer employee.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description *</Label>
                <Textarea
                  id="desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline *</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={draft.deadline}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, deadline: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority *</Label>
                  <Select
                    value={draft.priority}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, priority: v as any }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {["low", "medium", "high", "urgent"].map((p) => (
                        <SelectItem key={p} value={p}>
                          {p[0].toUpperCase() + p.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign To *</Label>
                <Select
                  value={draft.assigneeId}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, assigneeId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      {
                        id: "3",
                        name: "Company Employee",
                        role: "COMPANY_EMPLOYEE",
                      },
                      {
                        id: "5",
                        name: "Dealer Employee",
                        role: "DEALER_EMPLOYEE",
                      },
                    ].map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role.replace("_", " ")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
