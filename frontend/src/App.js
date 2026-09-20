import React, { useEffect, useState, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import {
  PERIODS as MOCK_PERIODS, rp, queue as mockQueue, initialTrx, prod as mockProd, metrics as mockMetrics, rep as mockRep, initialConvs as mockConvs, DEMO_FLOWS, KB_DOCS as mockKbDocs, QUICK_REPLIES,
} from "@/data";
import {
  socket, useAnalytics, useAnalyticsSummary, useApprovals, useOrders, useConversations, useProducts, useKb,
  decideApproval, exportAnalyticsCSV, chatIntake, replyConversation, createProduct, updateProduct, deleteProduct, seedBackend,
} from "@/api";

/* ---------- palette (matches mockup jade/gold) ---------- */
const JADE = "#2FB98A";
const JADE_DIM = "#1B6B54";
const GOLD = "#D9A94B";
const DANGER = "#E0715F";
const PIE_COLORS = [JADE, GOLD, "#7FE3C0", "#C97E56", "#B08A38"];

/* ---------- CSV export helper ---------- */
function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Toast hook ---------- */
function useToast() {
  const [msg, setMsg] = useState("");
  const tRef = useRef(null);
  const show = (m) => {
    setMsg(m);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setMsg(""), 2600);
  };
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return { show, node };
}

/* ---------- Recharts custom tooltip ---------- */
const ChartTooltip = ({ active, payload, label, valueSuffix = "" }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10,
      padding: "8px 12px", fontSize: 12, color: "var(--text)", boxShadow: "var(--card-shadow)",
    }}>
      {label && <div style={{ color: "var(--muted)", marginBottom: 4, fontSize: 11 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "var(--text-strong)", fontWeight: 600 }}>
          {p.name}: {p.value}{valueSuffix}
        </div>
      ))}
    </div>
  );
};

/* ============================================================
   MAIN APP
   ============================================================ */
export default function App() {
  const [view, setView] = useState("ringkasan");
  const [collapsed, setCollapsed] = useState(typeof window !== "undefined" && localStorage.getItem("tu-collapsed") === "1");
  const [theme, setTheme] = useState(typeof window !== "undefined" && localStorage.getItem("tu-theme") === "light" ? "light" : "dark");
  const [period, setPeriod] = useState("today");
  const [customDate, setCustomDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trxFilter, setTrxFilter] = useState("all");
  const [trx, setTrx] = useState(initialTrx);
  const [convs, setConvs] = useState(mockConvs);
  const [activeConv, setActiveConv] = useState(0);
  const [search, setSearch] = useState("");
  const [inboxPulse, setInboxPulse] = useState(0);
  const { show: toast, node: toastNode } = useToast();

  /* Real backend queries; mock data only as offline fallback */
  const analyticsQ = useAnalytics(period);
  const summaryQ = useAnalyticsSummary(period);
  const approvalsQ = useApprovals("pending");
  const ordersQ = useOrders({ limit: 100 });
  const convsQ = useConversations(50);

  const currentPeriod = useMemo(() => {
    const mock = MOCK_PERIODS[period] || MOCK_PERIODS.today;
    const be = analyticsQ.data;
    if (!be || analyticsQ.isError) return mock;
    // Merge: prefer backend values when present, else mock
    const omzet = (be.omzet_series && be.omzet_series.length ? be.omzet_series : mock.omzet);
    const intent = (be.intent && be.intent.length ? be.intent : mock.intent);
    const response = (be.response && be.response.length
      ? be.response.map((r) => ({ hour: r.hour, ms: r.ms }))
      : mock.response);
    const kategori = (be.kategori && be.kategori.length
      ? be.kategori.map((k) => ({ name: k.name, value: Math.round((k.omzet || 0) / 100000) / 10 || k.qty }))
      : mock.kategori);
    return {
      label: be.label || mock.label,
      omzet, kategori, intent, response,
      total: be.total || mock.total,
    };
  }, [period, analyticsQ.data, analyticsQ.isError]);

  const queue = useMemo(() => {
    if (!approvalsQ.data || !approvalsQ.data.items || approvalsQ.data.items.length === 0) return mockQueue;
    return approvalsQ.data.items.map((a) => ({
      n: a.order?.customer_id || (a.trace_id || "").slice(0, 8),
      d: (a.order?.items || []).map((it) => `${it.qty} pcs ${it.name}`).join(" · ") || "Draft pesanan",
      a: a.order?.total || 0,
      s: a.reminder_sent ? "jade" : "",
      approval_id: a.approval_id,
      order_id: a.order_id,
    }));
  }, [approvalsQ.data]);

  /* Real KPI from /analytics/summary; fallback to static cards when offline */
  const summaryKpi = summaryQ.data?.kpi || null;

  /* Sync real transactions from /orders into trx state (preserve local demo rows) */
  useEffect(() => {
    const items = ordersQ.data?.items;
    if (!items || items.length === 0) return;
    const beRows = items.map((o) => {
      const mins = Math.max(0, Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000)) || 0;
      const code = o.status === "pending_approval" ? "warn" : (o.status === "approved" || o.status === "modified" ? "ok" : "bad");
      const label = o.status === "pending_approval" ? "Pending approval" : (code === "ok" ? "Terkonfirmasi" : o.status);
      const summary = (o.items || []).map((it) => `${it.name} ×${it.qty}`).join(", ").slice(0, 60) || "—";
      return [o.order_id, o.customer_id, summary, o.total, code, label, mins, false, `be-${o.order_id}`];
    });
    setTrx((prev) => {
      const existing = new Set(prev.map((r) => r[0]));
      const fresh = beRows.filter((r) => !existing.has(r[0]));
      if (fresh.length === 0) return prev;
      // Replace mock initial rows once real data arrives
      const withoutMock = prev.filter((r) => !String(r[8] || "").startsWith("wa-") || String(r[0]).startsWith("TU-25"));
      const base = prev === initialTrx ? [] : withoutMock;
      return [...fresh, ...base.length ? base : prev.filter((r) => String(r[8] || "").startsWith("wa-"))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersQ.data]);

  /* Sync real inbox from /conversations into convs state */
  useEffect(() => {
    const items = convsQ.data?.items;
    if (!items || items.length === 0) return;
    const beConvs = items.map((c) => ({
      id: c.draft?.order_id || c.trace_id || c.customer_id,
      n: c.customer_id,
      ini: String(c.customer_id || "??").slice(0, 2).toUpperCase(),
      ch: c.channel || "WhatsApp",
      phone: c.customer_id,
      last: c.last || "",
      time: c.time || "",
      unread: 0,
      state: c.state || "answered",
      total: c.total || 0,
      thread: [[c.last_role === "owner" ? "agent" : "cust", c.last || "", c.time || ""]],
    }));
    setConvs((prev) => {
      const names = new Set(prev.map((c) => c.n));
      const fresh = beConvs.filter((c) => !names.has(c.n));
      if (fresh.length === 0) return prev;
      if (prev === mockConvs) return [...fresh];
      return [...fresh, ...prev];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convsQ.data]);

  useEffect(() => {
    const applyHash = () => {
      const h = window.location.hash.slice(1);
      if (["ringkasan", "inbox", "transaksi", "produk", "knowledge", "laporan"].includes(h)) setView(h);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("tu-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle("collapsed", collapsed);
    localStorage.setItem("tu-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  // B3 realtime: connect socket and refetch on relevant events
  useEffect(() => {
    socket.connect();
    const onApproval = (p) => { toast(`Approval baru · ${p.order_id || p.approval_id}`); approvalsQ.refetch?.(); ordersQ.refetch?.(); convsQ.refetch?.(); setInboxPulse((n) => n + 1); };
    const onDecided = (p) => { toast(`Approval ${p.decision} · ${p.order_id || ""}`); approvalsQ.refetch?.(); analyticsQ.refetch?.(); summaryQ.refetch?.(); ordersQ.refetch?.(); convsQ.refetch?.(); };
    const onChat = (p) => {
      if (p.auto) toast("Auto-response terkirim ke pelanggan");
      convsQ.refetch?.();
      ordersQ.refetch?.();
      setInboxPulse((n) => n + 1);
    };
    const onTrace = () => { analyticsQ.refetch?.(); summaryQ.refetch?.(); };
    socket.on("approval:required", onApproval);
    socket.on("approval:decided", onDecided);
    socket.on("approval:reminder", (p) => toast(`Reminder approval ${(p.approval_id || "").slice(0, 8)}`));
    socket.on("chat:new", onChat);
    socket.on("trace:update", onTrace);
    return () => {
      socket.off("approval:required", onApproval);
      socket.off("approval:decided", onDecided);
      socket.off("approval:reminder");
      socket.off("chat:new", onChat);
      socket.off("trace:update", onTrace);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // close date picker on outside click
  useEffect(() => {
    if (!showDatePicker) return;
    const h = (e) => {
      if (!e.target.closest(".period-wrap")) setShowDatePicker(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [showDatePicker]);

  const titles = {
    ringkasan: ["Operasional / Ringkasan", "Ringkasan Harian"],
    inbox: ["Operasional / Inbox Chat", "Inbox Chat Pelanggan"],
    transaksi: ["Operasional / Transaksi", "Transaksi & Approval"],
    produk: ["Operasional / Produk", "Produk & Stok"],
    knowledge: ["Operasional / Knowledge Base", "Knowledge Base Agent"],
    laporan: ["Operasional / Laporan", "Laporan & Performa"],
  };

  const goView = (v) => {
    setView(v);
    if (v === "inbox") setInboxPulse(0);
    window.location.hash = v;
    window.scrollTo({ top: 0 });
  };

  /* Synthetic Demo Controls — inject conversation & fire real chat/intake to backend */
  const playDemoFlow = (flowKey) => {
    const flow = DEMO_FLOWS[flowKey];
    if (!flow) return;
    const c = { ...flow.conv, time: new Date().toTimeString().slice(0, 5) };
    setConvs((prev) => [c, ...prev]);
    setActiveConv(0);
    goView("inbox");
    toast(`${flow.label} · auto-inject conversation`);

    // Real backend call — first customer message from the thread
    const firstCust = flow.conv.thread.find((t) => t[0] === "cust")?.[1] || "halo";
    chatIntake({
      customer_id: `demo-${flowKey}-${Date.now()}`,
      message_text: firstCust,
      channel: "WhatsApp",
    })
      .then((res) => {
        toast(`Trace ${(res.trace_id || "").slice(0, 8)} · ${res.status}`);
        if (res.draft) {
          const row = [res.draft.order_id, c.n, firstCust.slice(0, 40), res.draft.total, "warn", "Pending approval", 0, false, `wa-be-${Date.now()}`];
          setTrx((prev) => [row, ...prev]);
        }
        approvalsQ.refetch?.();
        analyticsQ.refetch?.();
        summaryQ.refetch?.();
        ordersQ.refetch?.();
        convsQ.refetch?.();
      })
      .catch((err) => {
        // Fallback ke local push (cascade PRD:217)
        if (c.id && c.id.startsWith("TU-") && c.total > 0) {
          const row = [c.id, c.n, c.thread.find((t) => t[0] === "cust")?.[1]?.slice(0, 40) || "—", c.total, "warn", "Pending approval", 0, false, `wa-demo-${Date.now()}`];
          setTrx((prev) => [row, ...prev]);
        }
        toast(`Backend fallback: ${err?.response?.status || "offline"}`);
      });
  };

  const exportCSV = () => {
    exportAnalyticsCSV(period)
      .then(() => toast("Ekspor CSV berhasil"))
      .catch(() => {
        // fallback local CSV from mock data
        const rows = [
          ["Periode", "Order", "Omzet", "Akurasi", "Intervensi"],
          ...mockRep.map((r) => [r[0], r[1], r[2], r[3], r[4]]),
        ];
        downloadCSV(`tuntas-umkm-report-${period}-${Date.now()}.csv`, rows);
        toast("Ekspor CSV (fallback lokal)");
      });
  };

  const approveFromQueue = (approval_id) => {
    decideApproval(approval_id, "approve", { reason: "operator ok" })
      .then((r) => { toast(`Order ${r.order.order_id} approved`); approvalsQ.refetch(); analyticsQ.refetch(); ordersQ.refetch?.(); summaryQ.refetch?.(); })
      .catch(() => toast("Gagal approve"));
  };
  const rejectFromQueue = (approval_id) => {
    decideApproval(approval_id, "reject", { reason: "operator tolak" })
      .then(() => { toast("Rejected"); approvalsQ.refetch(); ordersQ.refetch?.(); })
      .catch(() => toast("Gagal reject"));
  };

  return (
    <>
      <div className="grain" aria-hidden="true"></div>

      {/* SIDEBAR */}
      <aside className="sidebar" data-testid="sidebar">
        <div className="brand">
          <a className="logo" href="#ringkasan" onClick={(e) => { e.preventDefault(); goView("ringkasan"); }} aria-label="TuntasUMKM">
            <svg className="logo-mark" width="30" height="30" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="58" height="58" rx="16" fill="#047857" />
              <path d="M14 17H48L40 25H32V38L47 23L53 29L30 52L24 46V25H14V17Z" fill="#F7E6A8" />
            </svg>
            <span className="logo-text">
              <strong>Tuntas<em>UMKM</em></strong>
              <small>AI Agent Operasional</small>
            </span>
          </a>
        </div>

        <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)} data-testid="sidebar-toggle" aria-label="Collapse sidebar" title="Collapse sidebar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6.5 9 12l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <nav className="nav" data-testid="sidebar-nav">
          <p className="nav-label">Operasional</p>
          {[
            { key: "ringkasan", label: "Ringkasan", icon: "M4 4h6v9H4zM4 16h6v4H4zM14 11h6v9h-6zM14 4h6v4h-6z" },
            { key: "inbox", label: "Inbox Chat", icon: "M20.5 11.8a8.2 8.2 0 0 1-11.9 7.3L4 20.5l1.4-4.5A8.2 8.2 0 1 1 20.5 11.8z", pill: convs.length, pulse: inboxPulse > 0 },
            { key: "transaksi", label: "Transaksi", icon: "M3.5 8.5h13m-3.5-3.5 3.5 3.5-3.5 3.5M20.5 15.5h-13m3.5-3.5-3.5 3.5 3.5 3.5", pill: trx.filter((t) => t[4] === "warn").length },
            { key: "produk", label: "Produk & Stok", icon: "M12 3.2 4 7.3v9.4l8 4.1 8-4.1V7.3zM4 7.3l8 4.1 8-4.1M12 11.4V20.8" },
            { key: "knowledge", label: "Knowledge Base", icon: "M4.5 5.2A1.7 1.7 0 0 1 6.2 3.5H19v14H6.2a1.7 1.7 0 0 0-1.7 1.7zM4.5 19.2a1.7 1.7 0 0 0 1.7 1.8H19M8.5 7.6h6.5M8.5 11.2h4.5", pill: "RAG" },
            { key: "laporan", label: "Laporan", icon: "M4 20h16M7 20V10M12 20V4.5M17 20v-6.5" },
          ].map((n) => (
            <a
              key={n.key}
              className={`nav-item ${view === n.key ? "active" : ""}`}
              href={`#${n.key}`}
              onClick={(e) => { e.preventDefault(); goView(n.key); }}
              data-view={n.key}
              data-tip={n.label}
              title={n.label}
              data-testid={`nav-${n.key}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={n.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>
              <span>{n.label}</span>
              {n.pulse && <i className="nav-pulse" aria-label="pesan baru" data-testid="nav-pulse-inbox"></i>}
              {n.pill != null && <i className="pill">{n.pill}</i>}
            </a>
          ))}
        </nav>

        <div className="side-foot">
          <div className="quota">
            <div className="quota-top"><span>Kuota Agent</span><b>78%</b></div>
            <div className="bar"><i style={{ width: "78%" }}></i></div>
            <p>3.120 / 4.000 pesan bulan ini</p>
          </div>
          <div className="user">
            <span className="avatar">RT</span>
            <span className="user-meta"><b>Bu Ratna</b><small>Toko Ratna Snack</small></span>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">
        <header className="topbar">
          <div>
            <p className="crumb">{titles[view][0]}</p>
            <h1>{titles[view][1]}</h1>
          </div>
          <div className="topbar-actions">
            <label className="search topbar-search">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <input type="text" placeholder="Cari pesanan, produk…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="global-search" />
            </label>

            <div className="period-wrap" style={{ position: "relative" }}>
              <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); setShowDatePicker((s) => !s); }} data-testid="period-btn">
                {currentPeriod.label} ▾
              </button>
              {showDatePicker && (
                <div className="period-menu" onClick={(e) => e.stopPropagation()}>
                  {Object.entries(MOCK_PERIODS).map(([k, p]) => (
                    <button
                      key={k}
                      className={`period-opt ${period === k ? "active" : ""}`}
                      onClick={() => { setPeriod(k); setShowDatePicker(false); toast(`Periode: ${p.label}`); }}
                      data-testid={`period-opt-${k}`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <div className="period-date-row">
                    <label>Tanggal:</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => {
                        setCustomDate(e.target.value);
                        const d = new Date(e.target.value);
                        const diff = Math.abs((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
                        const key = diff < 2 ? "today" : diff < 10 ? "week" : "month";
                        setPeriod(key);
                        toast(`Tanggal ${e.target.value} → ${MOCK_PERIODS[key].label}`);
                      }}
                      className="period-date"
                      data-testid="period-date-input"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Synthetic Demo Controls */}
            <div className="demo-controls" data-testid="demo-controls">
              <span className="demo-label">Demo</span>
              <button className="demo-btn flow1" onClick={() => playDemoFlow("flow1")} data-testid="demo-flow1" title="Auto-inject conversation Tanya">
                ▶ Flow 1 Tanya
              </button>
              <button className="demo-btn flow2" onClick={() => playDemoFlow("flow2")} data-testid="demo-flow2" title="Auto-inject conversation Pesan">
                ▶ Flow 2 Pesan
              </button>
              <button className="demo-btn flow3" onClick={() => playDemoFlow("flow3")} data-testid="demo-flow3" title="Auto-inject conversation Timeout">
                ▶ Flow 3 Timeout
              </button>
            </div>

            <button className="theme-btn" onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))} data-testid="theme-toggle" aria-label="Ganti tema" title="Ganti tema" aria-pressed={theme === "light"}>
              <svg className="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
              <svg className="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>

            <button className="gold-btn audit-pill" data-testid="approve-all-btn" onClick={() => { goView("inbox"); toast("Buka detail dari daftar percakapan"); }}>
              Tinjau Approval
            </button>
          </div>
        </header>

        {view === "ringkasan" && (
          <Ringkasan loading={loading} currentPeriod={currentPeriod} summaryKpi={summaryKpi} exportCSV={exportCSV} onOpenQueue={() => goView("inbox")} queue={queue} onApprove={approveFromQueue} onReject={rejectFromQueue} />
        )}
        {view === "inbox" && (
          <Inbox loading={loading} convs={convs} setConvs={setConvs} activeConv={activeConv} setActiveConv={setActiveConv} pushToast={toast} queue={queue} onApprove={approveFromQueue} onReject={rejectFromQueue} />
        )}
        {view === "transaksi" && (
          <Transaksi loading={loading} trx={trx} trxFilter={trxFilter} setTrxFilter={setTrxFilter} search={search} exportCSV={exportCSV} />
        )}
        {view === "produk" && <Produk loading={loading} />}
        {view === "knowledge" && <Knowledge />}
        {view === "laporan" && <Laporan loading={loading} currentPeriod={currentPeriod} exportCSV={exportCSV} />}
      </main>

      {toastNode}
    </>
  );
}

/* ============================================================
   RINGKASAN — 4 Recharts (LineChart, BarChart, PieChart, AreaChart)
   ============================================================ */
function Ringkasan({ loading, currentPeriod, summaryKpi, exportCSV, onOpenQueue, queue, onApprove, onReject }) {
  const omzetData = currentPeriod.omzet.map((v, i) => ({
    day: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][i] || `D${i + 1}`,
    omzet: v,
  }));
  const kategoriData = currentPeriod.kategori;
  const intentData = currentPeriod.intent;
  const responseData = currentPeriod.response;

  const kpiCards = summaryKpi
    ? [
        { label: "Order masuk via chat", val: String(summaryKpi.orders ?? 0), delta: `${summaryKpi.events ?? 0} events`, up: true },
        { label: "Omzet terkonfirmasi", val: `Rp ${(Number(summaryKpi.omzet || 0) / 1000000).toFixed(1).replace(".", ",")}`, unit: "jt", delta: "real dari backend", up: true },
        { label: "Akurasi ekstraksi order", val: String(summaryKpi.akurasi ?? 0), unit: "%", delta: "target ≥ 90%", up: true },
        { label: "Pending approval", val: String(summaryKpi.pending_approvals ?? 0), delta: `auto_hold ${summaryKpi.auto_hold ?? 0}`, up: false },
      ]
    : [
        { label: "Order masuk via chat", val: "48", delta: "+12,4% vs kemarin", up: true },
        { label: "Omzet terkonfirmasi", val: "Rp 9,4", unit: "jt", delta: "+6,1% vs kemarin", up: true },
        { label: "Akurasi ekstraksi order", val: "94", unit: "%", delta: "target ≥ 90%", up: true },
        { label: "Intervensi manual", val: "7", unit: "%", delta: "−2,3% vs kemarin", up: false },
      ];

  return (
    <section className="view active">
      <div className="kpi-grid">
        {kpiCards.map((k, i) => (
          <article key={i} className="card kpi" data-testid={`kpi-${i}`}>
            <p className="kpi-label">{k.label}</p>
            <h2>{k.val}{k.unit && <small>{k.unit}</small>}</h2>
            <span className={`delta ${k.up ? "up" : "down"}`}>{k.delta}</span>
          </article>
        ))}
      </div>

      {/* Row 1: LineChart + Approval Queue */}
      <div className="two-col">
        <Card className="card chart-card" data-testid="chart-omzet">
          <div className="card-head">
            <div><h3>Omzet 7 hari terakhir</h3><p>Order terkonfirmasi setelah approval · {currentPeriod.label}</p></div>
            <span className="tag jade">{currentPeriod.total}</span>
          </div>
          <div className="chart">
            {loading ? (
              <Skeleton style={{ height: 200, width: "100%" }} data-testid="skeleton-line" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={omzetData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="strokeG" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={JADE} />
                      <stop offset="100%" stopColor={GOLD} />
                    </linearGradient>
                    <linearGradient id="fillG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={JADE} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={JADE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "var(--chart-text)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--chart-text)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}jt`} />
                  <Tooltip content={<ChartTooltip valueSuffix=" jt" />} />
                  <Area type="monotone" dataKey="omzet" stroke="none" fill="url(#fillG)" />
                  <Line type="monotone" dataKey="omzet" stroke="url(#strokeG)" strokeWidth={2.8} dot={{ r: 3.5, fill: JADE, stroke: "var(--chart-dot)", strokeWidth: 2 }} activeDot={{ r: 6, fill: GOLD, stroke: "var(--chart-dot)", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <article className="card" data-testid="approval-queue">
          <div className="card-head"><div><h3>Menunggu approval</h3><p>Agent tidak eksekusi tanpa izin</p></div><span className="tag">{queue.length}</span></div>
          {loading ? (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }} data-testid="skeleton-queue">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 44, borderRadius: 10 }} />)}
            </div>
          ) : (
            <ul className="queue">
              {queue.map((q, i) => (
                <li key={i} data-testid="queue-item" style={{ cursor: i < 4 ? "pointer" : "default" }} onClick={() => i < 4 && onOpenQueue()}>
                  <span className={`dot ${q.s}`}></span>
                  <span className="q-meta"><b>{q.n}</b><small>{q.d}</small></span>
                  <span className="q-amt">{q.a === 0 ? "—" : rp(q.a)}</span>
                  {q.approval_id && (
                    <span style={{ display: "flex", gap: 6, marginLeft: 8 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="gold-btn sm"
                        data-testid={`approve-${q.approval_id}`}
                        onClick={() => onApprove?.(q.approval_id)}
                        style={{ padding: "4px 10px", fontSize: 11 }}
                      >Approve</button>
                      <button
                        className="ghost-btn sm"
                        data-testid={`reject-${q.approval_id}`}
                        onClick={() => onReject?.(q.approval_id)}
                        style={{ padding: "4px 10px", fontSize: 11 }}
                      >Tolak</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      {/* Row 2: BarChart + PieChart */}
      <div className="two-col">
        <Card className="card chart-card" data-testid="chart-kategori">
          <div className="card-head">
            <div><h3>Kontribusi penjualan</h3><p>Per kategori produk · {currentPeriod.label}</p></div>
            <span className="tag jade">{currentPeriod.total}</span>
          </div>
          <div className="chart">
            {loading ? (
              <Skeleton style={{ height: 220 }} data-testid="skeleton-bar" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={kategoriData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="barG" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor={JADE_DIM} />
                      <stop offset="100%" stopColor={JADE} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--chart-text)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--chart-text)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}jt`} />
                  <Tooltip content={<ChartTooltip valueSuffix=" jt" />} />
                  <Bar dataKey="value" fill="url(#barG)" radius={[9, 9, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="card chart-card" data-testid="chart-intent">
          <div className="card-head">
            <div><h3>Distribusi intent</h3><p>Klasifikasi pesan pelanggan · {currentPeriod.label}</p></div>
            <span className="tag">AI</span>
          </div>
          <div className="chart">
            {loading ? (
              <Skeleton style={{ height: 220 }} data-testid="skeleton-pie" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={intentData}
                    dataKey="value"
                    nameKey="name"
                    cx="42%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="var(--panel)"
                    strokeWidth={2}
                  >
                    {intentData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueSuffix="%" />} />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Row 3: AreaChart response time */}
      <Card className="card chart-card" data-testid="chart-response">
        <div className="card-head">
          <div><h3>Response time agent</h3><p>Waktu balas rata-rata (ms) · {currentPeriod.label}</p></div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="tag jade">avg 540ms</span>
            <button className="ghost-btn sm" onClick={exportCSV} data-testid="ringkasan-export">Ekspor CSV</button>
          </div>
        </div>
        <div className="chart">
          {loading ? (
            <Skeleton style={{ height: 200 }} data-testid="skeleton-area" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={responseData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={GOLD} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "var(--chart-text)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--chart-text)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} />
                <Tooltip content={<ChartTooltip valueSuffix=" ms" />} />
                <Area type="monotone" dataKey="ms" stroke={GOLD} strokeWidth={2.4} fill="url(#areaG)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </section>
  );
}

/* ============================================================
   INBOX
   ============================================================ */
function Inbox({ loading, convs, setConvs, activeConv, setActiveConv, pushToast, queue = [], onApprove, onReject }) {
  const c = convs[activeConv] || convs[0];
  const [draft, setDraft] = React.useState("");
  const threadRef = React.useRef(null);

  React.useEffect(() => {
    // Auto-scroll thread to bottom whenever active conversation or its length changes
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeConv, c?.thread?.length]);

  const sendReply = (overrideText) => {
    const text = (typeof overrideText === "string" ? overrideText : draft).trim();
    if (!text || !c) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const stamp = `${hh}:${mm}`;
    setConvs((prev) => prev.map((cv, i) => {
      if (i !== activeConv) return cv;
      return {
        ...cv,
        thread: [...(cv.thread || []), ["agent", text, stamp]],
        last: text.length > 46 ? text.slice(0, 46) + "…" : text,
        time: stamp,
        unread: 0,
      };
    }));
    setDraft("");
    // Best-effort persist to backend; keep optimistic UI on failure
    if (c.n && !String(c.n).startsWith("demo-")) {
      replyConversation(c.n, text, c.ch || "WhatsApp").catch(() => {});
    }
    pushToast?.("Balasan manual terkirim");
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  // AI intent detection — panel muncul kalau state=pending_approval & ada total
  const hasDraft = !!(c && c.state === "pending_approval" && c.total > 0);
  // Matching approval longgar (trim/lower) agar nama BE vs mock tetap ketemu
  const linkedApproval = React.useMemo(() => {
    if (!c) return null;
    const norm = (s) => String(s || "").trim().toLowerCase();
    return queue.find((q) => norm(q.n) === norm(c.n) || norm(q.n) === norm(c.id) || norm(q.order_id) === norm(c.id)) || null;
  }, [c, queue]);

  const draftItems = React.useMemo(() => {
    if (!c || !hasDraft) return [];
    // Derive line items from latest agent messages or fallback to `last`
    const lines = (c.thread || [])
      .filter((m) => m[0] === "agent" || m[0] === "tool")
      .map((m) => m[1])
      .join(" ");
    // fallback: 1 baris agregat
    return [{ name: c.last || "Draft pesanan", qty: 1, subtotal: c.total, hint: lines.slice(0, 80) }];
  }, [c, hasDraft]);

  const ongkir = hasDraft ? Math.max(0, Math.round((c.total || 0) * 0.05 / 1000) * 1000) : 0;
  const subtotal = hasDraft ? (c.total || 0) - ongkir : 0;

  const approveDraft = () => {
    if (linkedApproval?.approval_id && onApprove) {
      onApprove(linkedApproval.approval_id);
    } else {
      pushToast?.(`Draft ${c?.id || ""} di-approve (lokal)`);
    }
    // Optimistically mark conv as approved locally
    setConvs((prev) => prev.map((cv, i) => (i === activeConv ? { ...cv, state: "answered" } : cv)));
  };
  const rejectDraft = () => {
    if (linkedApproval?.approval_id && onReject) {
      onReject(linkedApproval.approval_id);
    } else {
      pushToast?.(`Draft ${c?.id || ""} ditolak (lokal)`);
    }
    setConvs((prev) => prev.map((cv, i) => (i === activeConv ? { ...cv, state: "answered" } : cv)));
  };

  return (
    <section className="view active">
      <div className={`inbox ${hasDraft ? "with-draft" : ""}`} data-testid="inbox-grid">
        <article className="card conv-card">
          <div className="card-head"><div><h3>Percakapan</h3><p>Masuk dari WhatsApp &amp; Instagram</p></div><span className="tag">{convs.length}</span></div>
          {loading ? (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }} data-testid="skeleton-conv">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 52, borderRadius: 10 }} />)}
            </div>
          ) : (
            <ul className="conv">
              {convs.map((cv, i) => (
                <li key={i} className={i === activeConv ? "active" : ""} onClick={() => setActiveConv(i)} data-testid={`conv-item-${i}`}>
                  <span className="avatar">{cv.ini}</span>
                  <span className="conv-meta"><b>{cv.n}</b><small>{cv.last}</small></span>
                  <span className="conv-side"><small>{cv.time}</small>{cv.unread ? <i className="pill">{cv.unread}</i> : null}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card chat-card">
          <div className="chat-head">
            <span className="avatar">{c?.ini}</span>
            <div className="chat-who"><b>{c?.n}</b><small>{c?.ch} · {c?.phone}</small></div>
            <span className={`badge ${c?.state === "pending_approval" ? "warn" : "ok"}`}>state: {c?.state}</span>
          </div>
          <div className="thread" ref={threadRef} data-testid="chat-thread">
            {c?.thread.map((m, i) => m[0] === "tool" ? (
              <div key={i} className="msg tool"><b>tool</b> · {m[1]}</div>
            ) : (
              <div key={i} className={`msg ${m[0]}`}>{m[1]}{m[2] && <small>{m[2]}</small>}</div>
            ))}
          </div>

          {/* Quick Replies */}
          <div className="quick-replies" data-testid="quick-replies" role="toolbar" aria-label="Balasan cepat">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q.key}
                type="button"
                className="chip"
                onClick={() => sendReply(q.text)}
                disabled={!c}
                data-testid={`quick-reply-${q.key}`}
                title={q.text}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="chat-composer" data-testid="chat-composer">
            <textarea
              className="chat-composer-input"
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder="Tulis balasan manual — Enter untuk kirim, Shift+Enter untuk baris baru"
              data-testid="chat-composer-input"
              disabled={!c}
            />
            <button
              type="button"
              className="chat-composer-send"
              onClick={() => sendReply()}
              disabled={!draft.trim() || !c}
              data-testid="chat-composer-send"
              aria-label="Kirim balasan"
              title="Kirim balasan (Enter)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.5 20.5 4l-4 16-4-7-9-1.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>
              <span>Kirim</span>
            </button>
          </div>
        </article>

        {/* Draft Order Panel — muncul otomatis saat AI mendeteksi intent order */}
        {hasDraft && (
          <aside className="card draft-panel" data-testid="draft-order-panel" aria-label="Draft order">
            <div className="draft-head">
              <div>
                <p className="draft-eyebrow">Draft transaksi</p>
                <h3>{c.id}</h3>
                <small className="draft-sub">Terdeteksi otomatis dari intent pesanan</small>
              </div>
              <span className="badge warn" data-testid="draft-badge-state">menunggu approval</span>
            </div>

            <div className="draft-customer">
              <span className="avatar sm">{c.ini}</span>
              <div>
                <b>{c.n}</b>
                <small>{c.ch} · {c.phone}</small>
              </div>
            </div>

            <ul className="draft-items" data-testid="draft-items">
              {draftItems.map((it, i) => (
                <li key={i}>
                  <span className="draft-item-name">
                    <b>{it.qty}×</b> {it.name}
                  </span>
                  <span className="mono strong">{rp(it.subtotal)}</span>
                </li>
              ))}
            </ul>

            <div className="draft-totals">
              <div className="row"><span>Subtotal</span><span className="mono">{rp(subtotal)}</span></div>
              <div className="row"><span>Ongkir (estimasi)</span><span className="mono">{rp(ongkir)}</span></div>
              <div className="row total"><span>Total</span><span className="mono strong" data-testid="draft-total">{rp(c.total)}</span></div>
            </div>

            <div className="draft-actions">
              <button
                type="button"
                className="gold-btn"
                onClick={approveDraft}
                data-testid="draft-approve-btn"
                title="Approve & kirim konfirmasi ke pelanggan"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Approve · 1-tap
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={rejectDraft}
                data-testid="draft-reject-btn"
              >
                Tolak
              </button>
            </div>

            <p className="draft-foot" data-testid="draft-linked">
              {linkedApproval?.approval_id
                ? <>Terhubung ke queue · <span className="mono">{linkedApproval.approval_id.slice(0, 8)}</span></>
                : <>Draft lokal (belum tersinkron backend)</>}
            </p>
          </aside>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   TRANSAKSI
   ============================================================ */
function Transaksi({ loading, trx, trxFilter, setTrxFilter, search, exportCSV }) {
  const relTime = (m) => {
    if (m < 1) return "baru saja";
    if (m < 60) return m + "m lalu";
    const h = Math.floor(m / 60), mm = m % 60;
    return mm ? `${h}j ${mm}m lalu` : `${h}j lalu`;
  };
  const filtered = trx
    .filter((r) => trxFilter === "all" || r[4] === trxFilter)
    .filter((r) => !search || r[1].toLowerCase().includes(search.toLowerCase()) || r[0].toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="view active">
      <div className="kpi-grid three">
        <article className="card kpi"><p className="kpi-label">Perlu approval</p><h2>{trx.filter((t) => t[4] === "warn").length}</h2><span className="delta">nilai Rp 2,1 jt</span></article>
        <article className="card kpi"><p className="kpi-label">Terkonfirmasi</p><h2>{trx.filter((t) => t[4] === "ok").length}</h2><span className="delta up">Rp 9,4 jt</span></article>
        <article className="card kpi"><p className="kpi-label">Duplikat dicegah</p><h2>3</h2><span className="delta">idempotency key aktif</span></article>
      </div>
      <article className="card">
        <div className="card-head">
          <div><h3>Daftar transaksi</h3><p>Hasil ekstraksi otomatis dari percakapan pelanggan</p></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="chips">
              {[["all", "Semua"], ["warn", "Pending"], ["ok", "Terkonfirmasi"]].map(([k, l]) => (
                <button key={k} className={`chip ${trxFilter === k ? "active" : ""}`} onClick={() => setTrxFilter(k)}>{l}</button>
              ))}
            </div>
            <button className="ghost-btn sm" onClick={exportCSV} data-testid="trx-export">Ekspor CSV</button>
          </div>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }} data-testid="skeleton-table">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} style={{ height: 40, borderRadius: 8 }} />)}
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>ID</th><th>Pelanggan</th><th>Ringkasan order</th><th>Nilai</th><th>Status</th><th>Waktu</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: "center", color: "var(--muted)", padding: "18px 12px" }}>Tidak ada transaksi</td></tr>
                ) : filtered.map((r) => (
                  <tr key={r[0]}>
                    <td className="mono">{r[0]}</td>
                    <td className="strong">{r[1]}</td>
                    <td>{r[2]}</td>
                    <td className="strong">{rp(r[3])}</td>
                    <td><span className={`badge ${r[4]}`}>{r[5]}</span></td>
                    <td className="mono">{relTime(r[6])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </article>
    </section>
  );
}

/* ============================================================
   PRODUK
   ============================================================ */
function Produk({ loading }) {
  const [q, setQ] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ sku: "", name: "", price: "", stock: "", cap: "", category: "Snack", description: "" });
  const [err, setErr] = React.useState("");
  const productsQ = useProducts(q, "");
  const items = productsQ.data?.items || mockProd.map((p) => ({ sku: p[0], name: p[1], category: p[2], price: p[3], stock: p[4], cap: p[5] }));
  const skuAktif = productsQ.data?.total ?? items.length;
  const kritis = items.filter((p) => p.cap > 0 && (p.stock / p.cap) * 100 < 20).length;
  const nilai = items.reduce((a, p) => a + Number(p.price || 0) * Number(p.stock || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await createProduct({
        sku: form.sku.trim().toUpperCase(),
        name: form.name.trim(),
        price: Number(form.price),
        stock: Number(form.stock),
        cap: Number(form.cap || form.stock),
        category: form.category,
        description: form.description,
        variants: [],
      });
      setShowForm(false);
      setForm({ sku: "", name: "", price: "", stock: "", cap: "", category: "Snack", description: "" });
      productsQ.refetch?.();
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Gagal tambah produk (cek SKU unik & price>0)");
    }
  };

  const del = async (sku) => {
    if (!window.confirm(`Hapus ${sku}?`)) return;
    try {
      await deleteProduct(sku);
      productsQ.refetch?.();
    } catch {
      setErr("Gagal hapus produk");
    }
  };

  return (
    <section className="view active">
      <div className="kpi-grid three">
        <article className="card kpi"><p className="kpi-label">SKU aktif</p><h2>{skuAktif}</h2><span className="delta">katalog tersinkron</span></article>
        <article className="card kpi"><p className="kpi-label">Stok kritis</p><h2>{kritis}</h2><span className="delta down">perlu restock</span></article>
        <article className="card kpi"><p className="kpi-label">Nilai persediaan</p><h2>{rp(Math.round(nilai))}</h2><span className="delta up">real dari backend</span></article>
      </div>
      <article className="card">
        <div className="card-head">
          <div><h3>Produk &amp; stok</h3><p>Sumber jawaban agent untuk pertanyaan stok &amp; harga</p></div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="period-date" placeholder="Cari SKU/nama…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="produk-search" style={{ minWidth: 180 }} />
            <button className="gold-btn sm" onClick={() => setShowForm((s) => !s)} data-testid="produk-add-btn">+ Produk</button>
            <button className="ghost-btn sm" onClick={() => { seedBackend().then(() => productsQ.refetch?.()); }} data-testid="produk-seed-btn">Seed 50 produk</button>
          </div>
        </div>
        {err && <div style={{ padding: "8px 12px", color: "var(--danger)" }} role="alert">{err}</div>}
        {showForm && (
          <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 12 }} data-testid="produk-form">
            <input required placeholder="SKU MIS: KRP-01" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="period-date" />
            <input required placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="period-date" />
            <input required type="number" min="1" placeholder="Harga" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="period-date" />
            <input required type="number" min="0" placeholder="Stok" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="period-date" />
            <input type="number" min="0" placeholder="Cap" value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} className="period-date" />
            <input placeholder="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="period-date" />
            <button className="gold-btn sm" type="submit">Simpan</button>
          </form>
        )}
        <div className="table-wrap">
          {loading || productsQ.isLoading ? (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 40, borderRadius: 8 }} />)}
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>SKU</th><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: "center", color: "var(--muted)", padding: 18 }}>Tidak ada produk — klik Seed 50 produk</td></tr>
                ) : items.map((p) => {
                  const pct = p.cap > 0 ? Math.round((p.stock / p.cap) * 100) : 100, low = pct < 20;
                  return (
                    <tr key={p.sku}>
                      <td className="mono">{p.sku}</td>
                      <td className="strong">{p.name}</td>
                      <td className="mono">{p.category}</td>
                      <td>{rp(Number(p.price || 0))}</td>
                      <td>
                        <div className={`stockbar ${low ? "low" : ""}`}><i style={{ width: `${Math.min(pct, 100)}%` }}></i></div>
                        <span className="mono">{p.stock} / {p.cap} pcs</span>
                      </td>
                      <td><span className={`badge ${low ? "bad" : "ok"}`}>{low ? "Stok kritis" : "Aman"}</span></td>
                      <td><button className="ghost-btn sm" onClick={() => del(p.sku)} data-testid={`produk-del-${p.sku}`}>Hapus</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </article>
    </section>
  );
}

/* ============================================================
   KNOWLEDGE
   ============================================================ */
function Knowledge() {
  const [q, setQ] = React.useState("");
  const [tag, setTag] = React.useState("all");
  const kbQ = useKb(q, tag);
  const docs = kbQ.data?.items || mockKbDocs;

  const tags = React.useMemo(() => {
    const s = new Set(docs.map((d) => d.tag));
    return ["all", ...Array.from(s)];
  }, [docs]);

  const filtered = docs.filter((d) => (tag === "all" || d.tag === tag) && (!q || d.name.toLowerCase().includes(q.toLowerCase())));

  const kindColor = (k) => ({
    PDF: "danger", DOCX: "info", MD: "jade", XLSX: "gold", CSV: "muted",
  }[k] || "muted");

  const statusBadge = (s) => {
    if (s === "syncing") return <span className="badge warn" data-testid="kb-status-syncing">syncing…</span>;
    if (s === "stale") return <span className="badge bad" data-testid="kb-status-stale">perlu sinkron</span>;
    return <span className="badge ok" data-testid="kb-status-synced">tersinkron</span>;
  };

  return (
    <section className="view active">
      <article className="card kb-banner">
        <span className="kb-banner-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 3.2 4.5 6.4v5.3c0 4.4 3.1 8.2 7.5 9.1 4.4-.9 7.5-4.7 7.5-9.1V6.4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="m8.8 12.2 2.4 2.4 4-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div>
          <h3>Dokumen sumber RAG</h3>
          <p>Satu-satunya kebenaran untuk <b>harga</b>, <b>stok</b>, dan <b>kebijakan</b>.</p>
        </div>
        <span className="tag jade">grounding wajib</span>
      </article>

      <div className="kpi-grid three">
        <article className="card kpi"><p className="kpi-label">Dokumen aktif</p><h2>{docs.length}</h2><span className="delta up">{kbQ.data ? "real dari backend" : "offline fallback"}</span></article>
        <article className="card kpi"><p className="kpi-label">Potongan terindeks</p><h2>{docs.reduce((a, d) => a + (d.chunks || 0), 0).toLocaleString("id-ID")}<small>chunk</small></h2><span className="delta">embedding tersinkron</span></article>
        <article className="card kpi"><p className="kpi-label">Jawaban ber-sitasi</p><h2>96<small>%</small></h2><span className="delta up">target ≥ 90%</span></article>
      </div>

      <article className="card" data-testid="kb-docs-card">
        <div className="card-head">
          <div>
            <h3>Daftar dokumen</h3>
            <p>Nama file, ukuran &amp; waktu sinkron terakhir · dipakai agent untuk grounding</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label className="search kb-search-inline">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <input type="text" placeholder="Cari nama dokumen…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="kb-search-input" />
            </label>
            <div className="chips">
              {tags.map((t) => (
                <button key={t} className={`chip ${tag === t ? "active" : ""}`} onClick={() => setTag(t)} data-testid={`kb-tag-${t}`}>
                  {t === "all" ? "Semua" : t}
                </button>
              ))}
            </div>
            <button className="gold-btn sm" data-testid="kb-upload-btn" title="Unggah dokumen baru">+ Unggah</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table kb-table" data-testid="kb-table">
            <thead>
              <tr>
                <th style={{ width: "42%" }}>Nama dokumen</th>
                <th>Tipe</th>
                <th>Ukuran</th>
                <th>Chunk</th>
                <th>Terakhir sinkron</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: "center", color: "var(--muted)", padding: "18px 12px" }}>Dokumen tidak ditemukan</td></tr>
              ) : filtered.map((d) => (
                <tr key={d.id} data-testid={`kb-row-${d.id}`}>
                  <td>
                    <div className="kb-file">
                      <span className={`kb-file-ico ${kindColor(d.kind)}`}>
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                          <path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                          <path d="M14 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div>
                        <b>{d.name}</b>
                        <small className="mono">tag · {d.tag}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge mono">{d.kind}</span></td>
                  <td className="mono">{d.size}</td>
                  <td className="mono">{d.chunks.toLocaleString("id-ID")}</td>
                  <td className="mono">{d.lastSync}</td>
                  <td>{statusBadge(d.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

/* ============================================================
   LAPORAN
   ============================================================ */
function Laporan({ loading, currentPeriod, exportCSV }) {
  const kategoriData = currentPeriod.kategori;
  const summaryQ = useAnalyticsSummary("week");
  const kpi = summaryQ.data?.kpi;
  const metricsReal = kpi
    ? [
        ["Order terkonfirmasi", Math.min(100, (kpi.orders || 0) * 10), `${kpi.orders ?? 0} order`],
        ["Akurasi ekstraksi order", Number(kpi.akurasi || 0), "target ≥ 90%"],
        ["Pending approval", Math.min(100, (kpi.pending_approvals || 0) * 10), `${kpi.pending_approvals ?? 0} menunggu`],
        ["Auto-hold (timeout)", Math.min(100, (kpi.auto_hold || 0) * 10), `${kpi.auto_hold ?? 0} timeout`],
        ["Events logged", Math.min(100, kpi.events || 0), `${kpi.events ?? 0} events`],
      ]
    : mockMetrics;
  const repReal = kpi
    ? [
        ["Minggu berjalan", kpi.orders ?? 0, kpi.omzet ?? 0, `${kpi.akurasi ?? 0}%`, `${kpi.pending_approvals ?? 0} pending`],
      ]
    : mockRep;

  return (
    <section className="view active">
      <div className="two-col">
        <Card className="card chart-card">
          <div className="card-head"><div><h3>Kontribusi penjualan</h3><p>Per kategori produk · {currentPeriod.label}</p></div><span className="tag jade">{currentPeriod.total}</span></div>
          <div className="chart">
            {loading ? <Skeleton style={{ height: 220 }} /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={kategoriData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="lapBarG" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor={JADE_DIM} />
                      <stop offset="100%" stopColor={JADE} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--chart-text)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--chart-text)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}jt`} />
                  <Tooltip content={<ChartTooltip valueSuffix=" jt" />} />
                  <Bar dataKey="value" fill="url(#lapBarG)" radius={[9, 9, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <article className="card">
          <div className="card-head"><div><h3>Performa agent</h3><p>Metrik kualitas terhadap target {kpi ? "· real dari backend" : "· offline fallback"}</p></div></div>
          <ul className="metrics">
            {metricsReal.map((m, i) => (
              <li key={i}>
                <p><span>{m[0]}</span><b>{m[1]}%</b></p>
                <div className="bar"><i style={{ width: `${m[1]}%` }}></i></div>
                <p className="hint">{m[2]}</p>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="card">
        <div className="card-head"><div><h3>Rekap mingguan</h3><p>Siap diunduh untuk pembukuan</p></div><button className="ghost-btn sm" onClick={exportCSV} data-testid="laporan-export">Ekspor CSV</button></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Periode</th><th>Order</th><th>Omzet</th><th>Akurasi</th><th>Intervensi</th></tr></thead>
            <tbody>
              {repReal.map((r, i) => (
                <tr key={i}>
                  <td className="strong">{r[0]}</td>
                  <td>{r[1]}</td>
                  <td className="strong">{rp(r[2])}</td>
                  <td><span className="badge ok">{r[3]}</span></td>
                  <td className="mono">{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
