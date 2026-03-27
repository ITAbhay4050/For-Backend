import axios from "axios";
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  CreateTicketPayload,
  User,
  MachineDetailsResponse,
} from "@/types";
import { API_BASE } from "@/lib/apiConfig";

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// -----------------------------
// Request Interceptor
// -----------------------------
apiClient.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem("user");
    let token = "";

    if (stored) {
      try {
        const user = JSON.parse(stored);
        token = user?.token || "";
      } catch (error) {
        console.error("Error parsing user data:", error);
        localStorage.removeItem("user");
      }
    }

    if (token && config.headers) {
      config.headers["Authorization"] = `Token ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// -----------------------------
// Response Interceptor
// -----------------------------
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

// -----------------------------
// Error Handler
// -----------------------------
const handleApiError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      console.log("API ERROR:", error.response.data);

      const message =
        error.response.data?.detail ||
        error.response.data?.message ||
        error.response.data?.error ||
        error.response.statusText ||
        "Something went wrong";

      throw new Error(message);
    } else if (error.request) {
      throw new Error("No response from server");
    } else {
      throw new Error(error.message);
    }
  }

  throw new Error("Unknown error");
};

// -----------------------------
// Helpers
// -----------------------------
const extractData = (response: any) => {
  return response.data?.results || response.data;
};

const normalizeAssignedTo = (assigned: any) => {
  if (!assigned) return null;

  return {
    content_type: "employee",
    object_id: Number(assigned.object_id),
  };
};

// -----------------------------
// API Functions
// -----------------------------
export const getTicketCategories = async (): Promise<TicketCategory[]> => {
  try {
    const response = await apiClient.get("/ticket-categories/");
    return extractData(response);
  } catch (error) {
    return handleApiError(error);
  }
};

export const getTickets = async (): Promise<Ticket[]> => {
  try {
    const response = await apiClient.get("/tickets/");
    return extractData(response);
  } catch (error) {
    return handleApiError(error);
  }
};

export const getMachineDetails = async (
  params: { batch?: string; vin?: string }
): Promise<MachineDetailsResponse> => {
  try {
    const query = new URLSearchParams();

    if (params.batch) query.append("batch", params.batch);
    if (params.vin) query.append("vin", params.vin);

    const response = await apiClient.get(`/machine-details/?${query.toString()}`);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

export const createTicket = async (
  ticketData: CreateTicketPayload
): Promise<Ticket> => {
  try {
    if (ticketData.created_by) {
      ticketData.created_by = {
        content_type: ticketData.created_by.content_type,
        object_id: Number(ticketData.created_by.object_id),
      };
    }

    ticketData.assigned_to = normalizeAssignedTo(ticketData.assigned_to);
    delete (ticketData as any).machine_installation;
    ticketData.category = Number(ticketData.category);

    const response = await apiClient.post("/tickets/", ticketData);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

export const updateTicket = async (
  id: number | string,
  ticketData: Partial<CreateTicketPayload> & {
    status?: TicketStatus;
    resolution_notes?: string;
    feedback_notes?: string;
    rating?: number;
  }
): Promise<Ticket> => {
  try {
    if (ticketData.assigned_to) {
      ticketData.assigned_to = normalizeAssignedTo(ticketData.assigned_to);
    }

    delete (ticketData as any).machine_installation;

    const response = await apiClient.patch(`/tickets/${id}/`, ticketData);
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

export const deleteTicket = async (id: number | string): Promise<void> => {
  try {
    await apiClient.delete(`/tickets/${id}/`);
  } catch (error) {
    return handleApiError(error);
  }
};

export const getUsers = async (): Promise<User[]> => {
  try {
    const response = await apiClient.get("/users/");
    return extractData(response);
  } catch (error) {
    return handleApiError(error);
  }
};

export default apiClient;