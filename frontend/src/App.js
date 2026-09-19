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
  PERIODS as MOCK_PERIODS, rp, queue as mockQueue, initialTrx, prod, metrics, rep, initialConvs, DEMO_FLOWS,
} from "@/data";
import {
  socket, useAnalytics, useApprovals, decideApproval, exportAnalyticsCSV, chatIntake,
} from "@/api";

/* ---------- palette (matches mockup jade/gold) ---------- */
const JADE = "#2FB98A";
const JADE_DIM = "#1B6B54";
const GOLD = "#D9A94B";
const DANGER = "#E0715F";
const PIE_COLORS = [JADE, GOLD, "#7FE3C0", DANGER, "#B08A38"];

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
  const [convs, setConvs] = useState(initialConvs);
  const [activeConv, setActiveConv] = useState(0);
  const [search, setSearch] = useState("");
  const { show: toast, node: toastNode } = useToast();

  /* B4: fetch analytics for the selected period; fallback to mock on failure */
  const analyticsQ = useAnalytics(period);
  const approvalsQ = useApprovals("pending");

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
      n: a.order?.customer_id || a.trace_id.slice(0, 8),
      d: (a.order?.items || []).map((it) => `${it.qty} pcs ${it.name}`).join(" · ") || "Draft pesanan",
      a: a.order?.total || 0,
      s: a.reminder_sent ? "jade" : "",
      approval_id: a.approval_id,
      order_id: a.order_id,
    }));
  }, [approvalsQ.data]);

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
    const onApproval = (p) => { toast(`Approval baru · ${p.order_id || p.approval_id}`); approvalsQ.refetch?.(); };
    const onDecided = (p) => { toast(`Approval ${p.decision} · ${p.order_id || ""}`); approvalsQ.refetch?.(); analyticsQ.refetch?.(); };
    const onChat = (p) => { if (p.auto) toast("Auto-response terkirim ke pelanggan"); };
    const onTrace = () => { analyticsQ.refetch?.(); };
    socket.on("approval:required", onApproval);
    socket.on("approval:decided", onDecided);
    socket.on("approval:reminder", (p) => toast(`Reminder approval ${p.approval_id.slice(0, 8)}`));
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
        toast(`Trace ${res.trace_id.slice(0, 8)} · ${res.status}`);
        if (res.draft) {
          const row = [res.draft.order_id, c.n, firstCust.slice(0, 40), res.draft.total, "warn", "Pending approval", 0, false, `wa-be-${Date.now()}`];
          setTrx((prev) => [row, ...prev]);
        }
        approvalsQ.refetch?.();
        analyticsQ.refetch?.();
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
          ...rep.map((r) => [r[0], r[1], r[2], r[3], r[4]]),
        ];
        downloadCSV(`tuntas-umkm-report-${period}-${Date.now()}.csv`, rows);
        toast("Ekspor CSV (fallback lokal)");
      });
  };

  const approveFromQueue = (approval_id) => {
    decideApproval(approval_id, "approve", { reason: "operator ok" })
      .then((r) => { toast(`Order ${r.order.order_id} approved`); approvalsQ.refetch(); analyticsQ.refetch(); })
      .catch(() => toast("Gagal approve"));
  };
  const rejectFromQueue = (approval_id) => {
    decideApproval(approval_id, "reject", { reason: "operator tolak" })
      .then(() => { toast("Rejected"); approvalsQ.refetch(); })
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
            { key: "inbox", label: "Inbox Chat", icon: "M20.5 11.8a8.2 8.2 0 0 1-11.9 7.3L4 20.5l1.4-4.5A8.2 8.2 0 1 1 20.5 11.8z", pill: convs.length },
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
          <Ringkasan loading={loading} currentPeriod={currentPeriod} exportCSV={exportCSV} onOpenQueue={() => goView("inbox")} queue={queue} onApprove={approveFromQueue} onReject={rejectFromQueue} />
        )}
        {view === "inbox" && (
          <Inbox loading={loading} convs={convs} activeConv={activeConv} setActiveConv={setActiveConv} />
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
function Ringkasan({ loading, currentPeriod, exportCSV, onOpenQueue, queue, onApprove, onReject }) {
  const omzetData = currentPeriod.omzet.map((v, i) => ({
    day: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][i] || `D${i + 1}`,
    omzet: v,
  }));
  const kategoriData = currentPeriod.kategori;
  const intentData = currentPeriod.intent;
  const responseData = currentPeriod.response;

  const kpiCards = [
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
          <div className="card-head"><div><h3>Menunggu approval</h3><p>Agent tidak eksekusi tanpa izin</p></div><span className="tag">6</span></div>
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
function Inbox({ loading, convs, activeConv, setActiveConv }) {
  const c = convs[activeConv] || convs[0];
  return (
    <section className="view active">
      <div className="inbox">
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
          <div className="thread">
            {c?.thread.map((m, i) => m[0] === "tool" ? (
              <div key={i} className="msg tool"><b>tool</b> · {m[1]}</div>
            ) : (
              <div key={i} className={`msg ${m[0]}`}>{m[1]}{m[2] && <small>{m[2]}</small>}</div>
            ))}
          </div>
        </article>
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
  return (
    <section className="view active">
      <div className="kpi-grid three">
        <article className="card kpi"><p className="kpi-label">SKU aktif</p><h2>24</h2><span className="delta">katalog tersinkron</span></article>
        <article className="card kpi"><p className="kpi-label">Stok kritis</p><h2>4</h2><span className="delta down">perlu restock</span></article>
        <article className="card kpi"><p className="kpi-label">Nilai persediaan</p><h2>Rp 31,8<small>jt</small></h2><span className="delta up">+3,2%</span></article>
      </div>
      <article className="card">
        <div className="card-head"><div><h3>Produk &amp; stok</h3><p>Sumber jawaban agent untuk pertanyaan stok &amp; harga</p></div><button className="gold-btn sm">+ Produk</button></div>
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 40, borderRadius: 8 }} />)}
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>SKU</th><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th></tr></thead>
              <tbody>
                {prod.map((p) => {
                  const pct = Math.round((p[4] / p[5]) * 100), low = pct < 20;
                  return (
                    <tr key={p[0]}>
                      <td className="mono">{p[0]}</td>
                      <td className="strong">{p[1]}</td>
                      <td className="mono">{p[2]}</td>
                      <td>{rp(p[3])}</td>
                      <td>
                        <div className={`stockbar ${low ? "low" : ""}`}><i style={{ width: `${Math.min(pct, 100)}%` }}></i></div>
                        <span className="mono">{p[4]} / {p[5]} pcs</span>
                      </td>
                      <td><span className={`badge ${low ? "bad" : "ok"}`}>{low ? "Stok kritis" : "Aman"}</span></td>
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
        <article className="card kpi"><p className="kpi-label">Dokumen aktif</p><h2>8</h2><span className="delta up">2 diperbarui hari ini</span></article>
        <article className="card kpi"><p className="kpi-label">Potongan terindeks</p><h2>1.284<small>chunk</small></h2><span className="delta">embedding tersinkron</span></article>
        <article className="card kpi"><p className="kpi-label">Jawaban ber-sitasi</p><h2>96<small>%</small></h2><span className="delta up">target ≥ 90%</span></article>
      </div>
    </section>
  );
}

/* ============================================================
   LAPORAN
   ============================================================ */
function Laporan({ loading, currentPeriod, exportCSV }) {
  const kategoriData = currentPeriod.kategori;

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
          <div className="card-head"><div><h3>Performa agent</h3><p>Metrik kualitas terhadap target</p></div></div>
          <ul className="metrics">
            {metrics.map((m, i) => (
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
              {rep.map((r, i) => (
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
