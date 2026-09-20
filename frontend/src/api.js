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

export function useProducts(search, kategori) {
  return useQuery({
    queryKey: ["products", search || "", kategori || ""],
    queryFn: async () =>
      (
        await api.get("/products", {
          params: { ...(search ? { search } : {}), ...(kategori ? { kategori } : {}) },
        })
      ).data,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAnalyticsSummary(period = "today") {
  return useQuery({
    queryKey: ["analytics-summary", period],
    queryFn: async () => (await api.get("/analytics/summary", { params: { period } })).data,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useOrders(params = {}) {
  const { status, q, customer_id, limit = 50 } = params;
  return useQuery({
    queryKey: ["orders", status || "", q || "", customer_id || "", limit],
    queryFn: async () =>
      (
        await api.get("/orders", {
          params: {
            ...(status ? { status } : {}),
            ...(q ? { q } : {}),
            ...(customer_id ? { customer_id } : {}),
            limit,
          },
        })
      ).data,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useConversations(limit = 50) {
  return useQuery({
    queryKey: ["conversations", limit],
    queryFn: async () => (await api.get("/conversations", { params: { limit } })).data,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useConversation(customer_id) {
  return useQuery({
    queryKey: ["conversation", customer_id],
    queryFn: async () => (await api.get(`/conversations/${encodeURIComponent(customer_id)}`)).data,
    enabled: !!customer_id,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useKb(q, tag) {
  return useQuery({
    queryKey: ["kb", q || "", tag || ""],
    queryFn: async () =>
      (
        await api.get("/kb", {
          params: { ...(q ? { q } : {}), ...(tag && tag !== "all" ? { tag } : {}) },
        })
      ).data,
    staleTime: 60_000,
    retry: 1,
  });
}

/* ---------- Actions ---------- */
export const decideApproval = (id, action, body = {}) =>
  api.post(`/approvals/${id}/${action}`, body).then((r) => r.data);

export const chatIntake = (payload) =>
  api.post("/chat/intake", payload).then((r) => r.data);

export const replyConversation = (customer_id, text, channel = "WhatsApp") =>
  api.post(`/conversations/${encodeURIComponent(customer_id)}/reply`, { text, channel }).then((r) => r.data);

export const createProduct = (body) => api.post("/products", body).then((r) => r.data);
export const updateProduct = (sku, body) => api.put(`/products/${encodeURIComponent(sku)}`, body).then((r) => r.data);
export const deleteProduct = (sku) => api.delete(`/products/${encodeURIComponent(sku)}`).then((r) => r.data);
export const seedBackend = () => api.post("/seed").then((r) => r.data);
export const createKb = (body) => api.post("/kb", body).then((r) => r.data);

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
