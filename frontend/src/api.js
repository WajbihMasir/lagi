/* API client + Socket.IO client + query hooks (B4 wiring) */
import axios from "axios";
import { io } from "socket.io-client";
import { useQuery } from "@tanstack/react-query";

export const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
export const api = axios.create({ baseURL: `${API_BASE}/api`, timeout: 15000 });

/* Socket.IO — mounted at /api/socket.io on backend */
export const socket = io(API_BASE, {
  path: "/api/socket.io",
  autoConnect: false,
  transports: ["websocket", "polling"],
  reconnectionAttempts: 6,
});

/* ---------- Query hooks ---------- */
export function useAnalytics(period = "today") {
  return useQuery({
    queryKey: ["analytics", period],
    queryFn: async () => (await api.get("/analytics", { params: { period } })).data,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useTraces(limit = 20) {
  return useQuery({
    queryKey: ["traces", limit],
    queryFn: async () => (await api.get("/traces", { params: { limit } })).data,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useApprovals(status = "pending") {
  return useQuery({
    queryKey: ["approvals", status],
    queryFn: async () => (await api.get("/approvals", { params: { status } })).data,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    staleTime: 60_000,
    retry: 1,
  });
}

/* ---------- Actions ---------- */
export const decideApproval = (id, action, body = {}) =>
  api.post(`/approvals/${id}/${action}`, body).then((r) => r.data);

export const chatIntake = (payload) =>
  api.post("/chat/intake", payload).then((r) => r.data);

export const exportAnalyticsCSV = async (period) => {
  const res = await api.get("/analytics/export", { params: { period }, responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tuntas-analytics-${period}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
