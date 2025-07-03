/* ------------------------------------------------------------------ *
 *  Shared Role & Status Enums
 * ------------------------------------------------------------------ */
export enum UserRole {
  APPLICATION_ADMIN  = "APPLICATION_ADMIN",
  COMPANY_ADMIN      = "COMPANY_ADMIN",
  COMPANY_EMPLOYEE   = "COMPANY_EMPLOYEE",
  DEALER_ADMIN       = "DEALER_ADMIN",
  DEALER_EMPLOYEE    = "DEALER_EMPLOYEE",
}

export enum UserStatus {
  ACTIVE   = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING  = "PENDING",
}

/* ------------------------------------------------------------------ *
 *  Core Entities
 * ------------------------------------------------------------------ */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;

  /* optional / nice‑to‑have fields */
  phone?: string;
  username?: string;
  status?: UserStatus;
  companyId?: string;
  dealerId?: string;
  profilePhoto?: string;
  createdAt?: string;
  lastLogin?: string;
}

/* ----------  Company  ---------- */
export interface Company {
  id: string;
  name: string;

  /* address & geo */
  address: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;

  /* contact */
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;

  /* tax / compliance */
  gstNumber?: string;
  panNumber?: string;

  /* meta */
  status?: UserStatus;
  createdAt?: string;
}

/* ----------  Dealer  ---------- */
export interface Dealer {
  id: string;
  name: string;
  address: string;

  /* contact */
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;

  /* tax */
  gstNumber?: string;

  companyId: string;          // FK → Company
  status?: UserStatus;
  createdAt?: string;
}

/* ------------------------------------------------------------------ *
 *  Machine & photo helpers
 * ------------------------------------------------------------------ */
export interface MachinePhoto {
  id: number;
  photo: string;              // relative URL from backend
}

/**
 * NOTE:
 * Backend JSON comes in *snake_case* (e.g. model_number, serial_number).
 * We therefore define those exact keys so TypeScript recognises them and
 * VS Code red underlines disappear. If you later prefer camelCase on
 * the front‑end, map the response after fetch.
 */
/* ----------  Machine  ---------- */
export interface Machine {
  id: number;

  /* identifiers */
  model_number: string;
  serial_number: string;
  batch_number?: string | null;
  invoice_number?: string | null;

  /* installation */
  installation_date?: string | null;
  installed_by?: string | null;

  /* client / site info */
  client_company_name?: string | null;
  client_gst_number?: string | null;
  client_contact_person?: string | null;
  client_contact_phone?: string | null;
  location?: string | null;

  /* misc */
  notes?: string | null;
  photos: MachinePhoto[];

  /* status & meta */
  status: "pending" | "installed" | "servicing" | "decommissioned";
  created_at?: string;
}

/* ----------  Task  ---------- */
export interface Task {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  deadline: string;

  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in-progress" | "completed" | "cancelled";

  assignerId: string;
  assigneeId: string;

  /* machine linkage */
  machineId?: string;
  serialNumber?: string;   // convenience when machineId unknown
}

/* ----------  Ticket  ---------- */
export interface Ticket {
  id: string;
  machineId: string;
  serialNumber?: string;          // mirrors Task serialNumber

  issueDescription: string;
  dateReported: string;

  reportedById: string;
  assignedToId?: string;

  status: "open" | "in-progress" | "resolved" | "closed";
  urgency: "low" | "medium" | "high" | "critical";
  resolutionNotes?: string;

  /* feedback objects are optional & nested */
  feedback?: {
    dealerAdminFeedback?: {
      satisfactionScore: number;
      comments: string;
      followUpNeeded: boolean;
      submittedAt: string;
      submittedBy: string;
    };
    dealerEmployeeFeedback?: {
      satisfactionScore: number;
      comments: string;
      followUpNeeded: boolean;
      submittedAt: string;
      submittedBy: string;
    };
  };

  dealerId?: string;  // which dealer raised / owns this ticket
  createdAt?: string;
}

/* ------------------------------------------------------------------ *
 *  Access‑control helper
 * ------------------------------------------------------------------ */
export interface RoleAccess {
  role: UserRole;

  canAccessPages: string[];
  canManageUsers: boolean;
  canAssignTasks: boolean;
  canCreateTickets: boolean;
  canCloseTickets: boolean;
  canInstallMachines: boolean;
}
