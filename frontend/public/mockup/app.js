/* TuntasUMKM — static mockup (no backend) */
const rp = n => "Rp " + n.toLocaleString("id-ID");

/* ---------- sidebar collapse ---------- */
const body = document.body;
const btn = document.getElementById("collapseBtn");
if (localStorage.getItem("tu-collapsed") === "1") body.classList.add("collapsed");
btn.addEventListener("click", () => {
  body.classList.toggle("collapsed");
  localStorage.setItem("tu-collapsed", body.classList.contains("collapsed") ? "1" : "0");
});

/* ---------- tema terang / gelap ---------- */
const themeBtn = document.getElementById("themeBtn");
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("tu-theme", t);
  themeBtn.setAttribute("aria-pressed", t === "light" ? "true" : "false");
  themeBtn.title = t === "light" ? "Beralih ke mode gelap" : "Beralih ke mode terang";
}
applyTheme(localStorage.getItem("tu-theme") === "light" ? "light" : "dark");
themeBtn.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  toast(document.documentElement.dataset.theme === "light" ? "Mode terang aktif" : "Mode gelap aktif");
});

/* ---------- routing ---------- */
const titles = {
  ringkasan: ["Operasional / Ringkasan", "Ringkasan Harian"],
  inbox: ["Operasional / Inbox Chat", "Inbox Chat Pelanggan"],
  transaksi: ["Operasional / Transaksi", "Transaksi & Approval"],
  produk: ["Operasional / Produk", "Produk & Stok"],
  knowledge: ["Operasional / Knowledge Base", "Knowledge Base Agent"],
  laporan: ["Operasional / Laporan", "Laporan & Performa"]
};
function go(view) {
  if (!titles[view]) view = "ringkasan";
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
  document.querySelectorAll(".nav-item").forEach(a => a.classList.toggle("active", a.dataset.view === view));
  document.getElementById("crumb").textContent = titles[view][0];
  document.getElementById("pageTitle").textContent = titles[view][1];
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", () => go(location.hash.slice(1)));
go(location.hash.slice(1) || "ringkasan");

/* ---------- data ---------- */
const omzet = [6.2, 7.8, 7.1, 8.9, 8.2, 10.6, 9.4];
const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const queue = [
  { n: "Wulan Sari", d: "12 pcs Keripik Pisang · Balado", a: 348000, s: "" },
  { n: "Andi Pratama", d: "3 box Sambal Roa · pedas", a: 195000, s: "" },
  { n: "Dewi Lestari", d: "Tanya stok Rengginang 5kg", a: 0, s: "jade" },
  { n: "Toko Berkah", d: "20 pcs Kacang Telur · reseller", a: 540000, s: "" },
  { n: "Rizky Hidayat", d: "Retur 2 pcs — kemasan rusak", a: -62000, s: "red" },
  { n: "Sinta Maulida", d: "8 pcs Keripik Tempe · original", a: 216000, s: "" }
];

const trx = [
  ["TU-2411", "Wulan Sari",    "Keripik Pisang Balado ×12", 348000, "warn", "Pending approval",   2,  false, "wa-9087-0942"],
  ["TU-2410", "Andi Pratama",  "Sambal Roa ×3 box",         195000, "warn", "Pending approval",   26, true,  "wa-2210-0918"],
  ["TU-2409", "Toko Berkah",   "Kacang Telur ×20",          540000, "warn", "Pending approval",   49, false, "wa-3390-0855"],
  ["TU-2408", "Nabila Putri",  "Rengginang ×6",             174000, "ok",   "Terkonfirmasi",      73, false, "wa-1188-0831"],
  ["TU-2407", "Hendra Wijaya", "Keripik Tempe ×10",         270000, "ok",   "Terkonfirmasi",      100,true,  "wa-4423-0804"],
  ["TU-2406", "Rizky Hidayat", "Retur kemasan rusak",       -62000, "bad",  "Ditolak agent",      117,false, "wa-9917-0747"],
  ["TU-2405", "Sinta Maulida", "Paket Oleh-oleh ×2",        310000, "ok",   "Terkonfirmasi",      142,false, "wa-2044-0722"]
];

const prod = [
  ["KRP-01", "Keripik Pisang Balado", "Snack", 29000, 148, 200],
  ["SRO-02", "Sambal Roa Pedas", "Sambal", 65000, 24, 150],
  ["KCT-03", "Kacang Telur Gurih", "Snack", 27000, 96, 180],
  ["RNG-04", "Rengginang Original", "Snack", 29000, 11, 160],
  ["KTP-05", "Keripik Tempe Original", "Snack", 27000, 212, 250],
  ["PKO-06", "Paket Oleh-oleh Mix", "Bundling", 155000, 8, 60]
];

const metrics = [
  ["Akurasi ekstraksi order", 94, "target ≥ 90%"],  ["Akurasi stok & harga", 97, "target ≥ 95%"],
  ["Completion rate", 91, "target ≥ 85%"],
  ["Grounding rate", 88, "target ≥ 80%"],
  ["Intervensi manual", 7, "target ≤ 15%"]
];

const rep = [
  ["Minggu 1", 312, 12400000, "94%", "6%"],
  ["Minggu 2", 358, 14900000, "95%", "5%"],
  ["Minggu 3", 341, 13850000, "93%", "8%"],
  ["Minggu 4", 396, 17050000, "96%", "7%"]
];

/* ---------- render ---------- */
document.getElementById("queueList").innerHTML = queue.map((q, i) => `
  <li data-testid="queue-item" data-i="${i < 4 ? i : ""}" style="cursor:${i < 4 ? "pointer" : "default"}">
    <span class="dot ${q.s}"></span>
    <span class="q-meta"><b>${q.n}</b><small>${q.d}</small></span>
    <span class="q-amt">${q.a === 0 ? "—" : rp(q.a)}</span>
  </li>`).join("");

/* ---------- transaksi table (filterable) ---------- */
const trxTableEl = document.getElementById("trxTable");
let trxFilter = "all";

function relTime(m) {
  if (m < 1) return "baru saja";
  if (m < 60) return m + "m lalu";
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h}j ${mm}m lalu` : `${h}j lalu`;
}

const idempIcon = `<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" style="flex:none"><path d="M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderTrx() {
  const rows = trx.filter(r => trxFilter === "all" || r[4] === trxFilter);
  const body = rows.length
    ? rows.map(r => `<tr data-testid="trx-row-${r[0]}" data-id="${r[0]}" data-status="${r[4]}">
        <td class="mono">${r[0]}${r[7] ? `<span class="badge idem" data-testid="trx-idem-badge" title="idempotency key: ${r[8]}">${idempIcon}<span>idempotency key aktif</span></span>` : ""}</td>
        <td class="strong">${r[1]}</td>
        <td>${r[2]}</td>
        <td class="strong">${rp(r[3])}</td>
        <td><span class="badge ${r[4]}">${r[5]}</span></td>
        <td class="mono" data-testid="trx-time-${r[0]}">${relTime(r[6])}</td>
      </tr>`).join("")
    : `<tr data-testid="trx-empty"><td colspan="6" style="text-align:center;color:var(--muted);padding:18px 12px">Tidak ada transaksi pada filter ini</td></tr>`;
  trxTableEl.innerHTML = `
    <thead><tr><th>ID</th><th>Pelanggan</th><th>Ringkasan order</th><th>Nilai</th><th>Status</th><th>Waktu</th></tr></thead>
    <tbody>${body}</tbody>`;
}
renderTrx();

/* update transaksi row status locally (called after approve/reject in modal) */
function updateTrxByConvId(id, badgeCls, label) {
  const idx = trx.findIndex(r => r[0] === id);
  if (idx < 0) return;
  trx[idx][4] = badgeCls;
  trx[idx][5] = label;
  renderTrx();
}

document.getElementById("prodTable").innerHTML = `
  <thead><tr><th>SKU</th><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th></tr></thead>
  <tbody>${prod.map(p => {
    const pct = Math.round((p[4] / p[5]) * 100), low = pct < 20;
    return `<tr>
      <td class="mono">${p[0]}</td><td class="strong">${p[1]}</td><td class="mono">${p[2]}</td>
      <td>${rp(p[3])}</td>
      <td><div class="stockbar ${low ? "low" : ""}"><i style="width:${Math.min(pct,100)}%"></i></div>
          <span class="mono">${p[4]} / ${p[5]} pcs</span></td>
      <td><span class="badge ${low ? "bad" : "ok"}">${low ? "Stok kritis" : "Aman"}</span></td></tr>`;
  }).join("")}</tbody>`;

document.getElementById("metricList").innerHTML = metrics.map(m => `
  <li><p><span>${m[0]}</span><b>${m[1]}%</b></p>
  <div class="bar"><i style="width:${m[1]}%"></i></div>
  <p class="hint">${m[2]}</p></li>`).join("");

document.getElementById("repTable").innerHTML = `
  <thead><tr><th>Periode</th><th>Order</th><th>Omzet</th><th>Akurasi</th><th>Intervensi</th></tr></thead>
  <tbody>${rep.map(r => `<tr><td class="strong">${r[0]}</td><td>${r[1]}</td>
    <td class="strong">${rp(r[2])}</td><td><span class="badge ok">${r[3]}</span></td>
    <td class="mono">${r[4]}</td></tr>`).join("")}</tbody>`;

/* ---------- charts (hand-built SVG) ---------- */
(function line() {
  const W = 680, H = 175, pad = 28, max = 12;
  const x = i => pad + (i * (W - pad * 2)) / (omzet.length - 1);
  const y = v => H - pad - (v / max) * (H - pad * 1.6);
  const pts = omzet.map((v, i) => [x(i), y(v)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const grid = [0, 3, 6, 9, 12].map(v =>
    `<line class="grid-line" x1="${pad}" x2="${W - pad}" y1="${y(v)}" y2="${y(v)}"/>
     <text x="0" y="${y(v) + 3}">${v}jt</text>`).join("");
  document.getElementById("lineChart").innerHTML = `
  <svg viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="fillG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2FB98A" stop-opacity=".38"/>
        <stop offset="100%" stop-color="#2FB98A" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="strokeG" x1="0" y1="0" x2="1" y2="0">
        <stop class="g-a" offset="0%"/><stop class="g-b" offset="100%"/>
      </linearGradient>
    </defs>
    ${grid}
    <path d="${path} L ${x(omzet.length - 1)} ${H - pad} L ${pad} ${H - pad} Z" fill="url(#fillG)"/>
    <path d="${path}" fill="none" stroke="url(#strokeG)" stroke-width="2.6" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle class="${i === 5 ? "dot-hi" : "dot"}" cx="${p[0]}" cy="${p[1]}" r="${i === 5 ? 5.5 : 3.4}"
       stroke-width="2"/>`).join("")}
    ${days.map((d, i) => `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${d}</text>`).join("")}
    <text class="hi-label" x="${x(5)}" y="${y(omzet[5]) - 14}" text-anchor="middle">Rp 10,6 jt</text>
  </svg>`;
})();

(function bar() {
  const data = [["Snack", 24.6], ["Sambal", 14.2], ["Bundling", 11.1], ["Minuman", 5.3], ["Lainnya", 3.0]];
  const W = 680, H = 190, pad = 32, max = 28, bw = 54;
  const gap = (W - pad * 2 - bw * data.length) / (data.length - 1);
  document.getElementById("barChart").innerHTML = `
  <svg viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="barG" x1="0" y1="1" x2="0" y2="0">
      <stop class="g-a" offset="0%"/><stop class="g-b" offset="100%"/></linearGradient></defs>
    ${[0, 7, 14, 21, 28].map(v => { const yy = H - pad - (v / max) * (H - pad * 1.5);
      return `<line class="grid-line" x1="${pad}" x2="${W - pad}" y1="${yy}" y2="${yy}"/><text x="0" y="${yy + 3}">${v}jt</text>`; }).join("")}
    ${data.map((d, i) => {
      const h = (d[1] / max) * (H - pad * 1.5), xx = pad + i * (bw + gap), yy = H - pad - h;
      return `<rect x="${xx}" y="${yy}" width="${bw}" height="${h}" rx="9" fill="url(#barG)" opacity=".92"/>
        <text class="bar-val" x="${xx + bw / 2}" y="${yy - 9}" text-anchor="middle">${d[1]}jt</text>
        <text x="${xx + bw / 2}" y="${H - 14}" text-anchor="middle">${d[0]}</text>`; }).join("")}
  </svg>`;
})();

/* filter chips: transaksi has real filter, others are visual toggle */
document.querySelectorAll(".chips .chip").forEach(c =>
  c.addEventListener("click", () => {
    c.parentElement.querySelectorAll(".chip").forEach(o => o.classList.remove("active"));
    c.classList.add("active");
    if (c.parentElement.id === "trxChips") {
      trxFilter = c.dataset.filter || "all";
      renderTrx();
    }
  }));

/* ---------- inbox chat ---------- */
const convs = [
  {
    id: "TU-2411", n: "Wulan Sari", ini: "WS", ch: "WhatsApp", phone: "+62 812-3344-9087",
    last: "Oke bu, total berapa ya?", time: "09:42", unread: 2, state: "pending_approval",
    addr: "Jl. Kaliurang 21, Sleman", total: 348000,
    lines: [["Keripik Pisang Balado · 12 pcs", 330000], ["Ongkir JNE REG", 18000]],
    thread: [
      ["cust", "Bu, keripik pisang yg balado masih ada? mau 12 pcs", "09:38"],
      ["tool", "check_stock(sku=KRP-01) → tersedia 148 pcs", ""],
      ["agent", "Halo Kak Wulan 👋 Keripik Pisang Balado tersedia (stok 148 pcs). Harga Rp 27.500/pcs untuk pembelian ≥10 pcs.", "09:39"],
      ["cust", "Oke bu, total berapa ya? kirim ke Jl. Kaliurang 21 Sleman", "09:40"],
      ["tool", "calculate_total(qty=12, sku=KRP-01) → Rp 330.000 · ongkir JNE REG Rp 18.000", ""],
      ["agent", "Totalnya Rp 348.000 (12 pcs = Rp 330.000 + ongkir Rp 18.000). Saya siapkan draft pesanannya dulu ya Kak.", "09:41"],
      ["tool", "create_draft_order(idempotency_key=wa-9087-0942) → draft TU-2411 dibuat, menunggu approval pemilik", ""]
    ]
  },
  {
    id: "TU-2410", n: "Andi Pratama", ini: "AP", ch: "WhatsApp", phone: "+62 813-8891-2210",
    last: "3 box sambal roa yg pedas ya", time: "09:18", unread: 1, state: "pending_approval",
    addr: "Perum Griya Asri B-4, Depok", total: 195000,
    lines: [["Sambal Roa Pedas · 3 box", 195000]],
    thread: [
      ["cust", "3 box sambal roa yg pedas ya bu", "09:15"],
      ["tool", "check_stock(sku=SRO-02) → tersedia 24 box", ""],
      ["agent", "Siap Kak Andi, Sambal Roa Pedas 3 box = Rp 195.000. Alamat kirim masih Perum Griya Asri B-4?", "09:16"],
      ["cust", "iya bener bu", "09:18"],
      ["tool", "create_draft_order(idempotency_key=wa-2210-0918) → draft TU-2410 menunggu approval", ""]
    ]
  },
  {
    id: "—", n: "Dewi Lestari", ini: "DL", ch: "Instagram", phone: "@dewi.lestari",
    last: "Rengginang 5kg ready kak?", time: "08:57", unread: 0, state: "answered",
    addr: "—", total: 0, lines: [],
    thread: [
      ["cust", "Rengginang 5kg ready kak?", "08:55"],
      ["tool", "check_stock(sku=RNG-04) → sisa 11 pcs (stok kritis)", ""],
      ["agent", "Untuk Rengginang stok tinggal 11 pcs Kak, belum cukup 5kg. Restock masuk Kamis, mau saya kabari saat ready?", "08:56"],
      ["cust", "boleh kak", "08:57"]
    ]
  },
  {
    id: "TU-2409", n: "Toko Berkah", ini: "TB", ch: "WhatsApp", phone: "+62 856-7712-3390",
    last: "Kacang telur 20 pcs harga reseller", time: "08:55", unread: 1, state: "pending_approval",
    addr: "Pasar Kranggan blok C-12, Yogyakarta", total: 540000,
    lines: [["Kacang Telur Gurih · 20 pcs (reseller)", 520000], ["Ongkir instant", 20000]],
    thread: [
      ["cust", "Kacang telur 20 pcs harga reseller ya", "08:50"],
      ["tool", "check_policy(doc=kebijakan-reseller) → diskon reseller 4% untuk ≥20 pcs", ""],
      ["agent", "Sesuai kebijakan reseller, 20 pcs dapat harga Rp 26.000/pcs = Rp 520.000 + ongkir instant Rp 20.000.", "08:52"],
      ["cust", "oke gas bu", "08:55"],
      ["tool", "create_draft_order(idempotency_key=wa-3390-0855) → draft TU-2409 menunggu approval", ""]
    ]
  }
];

const convList = document.getElementById("convList");
convList.innerHTML = convs.map((c, i) => `
  <li data-i="${i}" class="${i === 0 ? "active" : ""}" data-testid="conv-item-${i}">
    <span class="avatar">${c.ini}</span>
    <span class="conv-meta"><b>${c.n}</b><small>${c.last}</small></span>
    <span class="conv-side"><small>${c.time}</small>${c.unread ? `<i class="pill">${c.unread}</i>` : ""}</span>
  </li>`).join("");

function renderConv(i) {
  currentConv = i;
  const c = convs[i];
  document.getElementById("chatAvatar").textContent = c.ini;
  document.getElementById("chatName").textContent = c.n;
  document.getElementById("chatMeta").textContent = `${c.ch} · ${c.phone}`;
  const st = document.querySelector('[data-testid="chat-state"]');
  st.textContent = "state: " + c.state;
  st.className = "badge " + (c.state === "pending_approval" ? "warn" : c.state === "rejected" ? "bad" : "ok");

  document.getElementById("thread").innerHTML = c.thread.map(m =>
    m[0] === "tool"
      ? `<div class="msg tool"><b>tool</b> · ${m[1]}</div>`
      : `<div class="msg ${m[0]}">${m[1]}${m[2] ? `<small>${m[2]}</small>` : ""}</div>`).join("");

  const draft = document.querySelector('[data-testid="draft-order"]');
  if (!c.lines.length) { draft.hidden = true; }
  else {
    draft.hidden = false;
    draft.querySelector(".draft-head b").textContent = "Draft order " + c.id;
    draft.querySelector(".q-amt").textContent = rp(c.total);
    document.getElementById("draftLines").innerHTML =
      c.lines.map(l => `<li><span>${l[0]}</span><span>${rp(l[1])}</span></li>`).join("");
    draft.querySelector('[data-testid="draft-approve"]').dataset.i = i;
  }
  convList.querySelectorAll("li").forEach(li => li.classList.toggle("active", +li.dataset.i === i));
  stepperFromConv(c);
}
convList.addEventListener("click", e => {
  const li = e.target.closest("li"); if (li) renderConv(+li.dataset.i);
});

/* ---------- chat stepper ---------- */
let currentConv = 0;
const stepperEl = document.getElementById("chatStepper");
const STEPS = [
  { key: "intake",        label: "Intake" },
  { key: "understanding", label: "Understanding" },
  { key: "grounding",     label: "Grounding" },
  { key: "tool",          label: "Tool Call" },
  { key: "approval",      label: "Approval" },
  { key: "response",      label: "Response" },
  { key: "analytics",     label: "Analytics" }
];

function renderStepper(activeIdx, tags) {
  tags = tags || {};
  stepperEl.innerHTML = STEPS.map((s, i) => {
    let state = i < activeIdx ? "done" : i === activeIdx ? "active" : "";
    const tag = tags[s.key] || "";
    const link = i < STEPS.length - 1 ? '<span class="link" aria-hidden="true"></span>' : "";
    return `<span class="step ${state}" data-step="${s.key}" data-testid="step-${s.key}" role="listitem">
      <span class="dot"></span>
      <span class="step-label">${s.label}</span>
      ${tag ? `<span class="mini-tag">${tag}</span>` : ""}
    </span>${link}`;
  }).join("");
}

function stepperFromConv(c) {
  if (c.state === "approved") {
    renderStepper(6, { intake: "✓", understanding: "intent tanya_produk 0.92", approval: "✓", response: "✓" });
  } else if (c.state === "answered") {
    renderStepper(6, { intake: "✓", understanding: "intent tanya_stok 0.88", response: "✓" });
  } else if (c.state === "understanding") {
    renderStepper(1, { intake: "✓", understanding: "intent tanya_produk 0.92" });
  } else if (c.state === "grounding") {
    renderStepper(2, { intake: "✓", understanding: "intent tanya_produk 0.92" });
  } else if (c.state === "tool_call") {
    renderStepper(3, { intake: "✓", understanding: "intent tanya_produk 0.92" });
  } else {
    // default: pending_approval
    renderStepper(4, { intake: "✓", understanding: "intent tanya_produk 0.92", approval: "⏳" });
  }
}

/* ---------- composer (Enter kirim, quick replies, tool simulation) ---------- */
const composerInput = document.getElementById("chatComposerInput");
const sendBtn = document.getElementById("chatSendBtn");
const quickReplies = document.getElementById("quickReplies");

function autoGrow() {
  composerInput.style.height = "auto";
  composerInput.style.height = Math.min(composerInput.scrollHeight, 140) + "px";
}
composerInput.addEventListener("input", autoGrow);
composerInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener("click", sendMessage);
quickReplies.addEventListener("click", e => {
  const b = e.target.closest("[data-q]");
  if (!b) return;
  composerInput.value = b.dataset.q;
  autoGrow();
  composerInput.focus();
});

function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

/* parse qty & sku hint dari isi pesan */
function parseIntent(txt) {
  const t = txt.toLowerCase();
  const qtyMatch = t.match(/(\d{1,3})\s*(pcs|box|paket|kaos|biji|item)?/);
  const qty = qtyMatch ? Math.max(1, Math.min(999, parseInt(qtyMatch[1], 10))) : 3;
  let sku = { code: "KRP-01", name: "Keripik Pisang Balado", unit: 27500 };
  if (/roa|sambal/.test(t))     sku = { code: "SRO-02", name: "Sambal Roa Pedas",       unit: 65000 };
  else if (/kacang/.test(t))    sku = { code: "KCT-03", name: "Kacang Telur Gurih",     unit: 27000 };
  else if (/rengginang/.test(t))sku = { code: "RNG-04", name: "Rengginang Original",    unit: 29000 };
  else if (/tempe/.test(t))     sku = { code: "KTP-05", name: "Keripik Tempe Original", unit: 27000 };
  else if (/paket|oleh/.test(t))sku = { code: "PKO-06", name: "Paket Oleh-oleh Mix",    unit: 155000 };
  const stok = { "KRP-01":148,"SRO-02":24,"KCT-03":96,"RNG-04":11,"KTP-05":212,"PKO-06":8 }[sku.code];
  return { qty, sku, stok };
}

function updateQueueForConv(c) {
  const list = document.getElementById("queueList");
  const idx = convs.indexOf(c);
  const inner = `
    <span class="dot"></span>
    <span class="q-meta"><b>${c.n}</b><small>Draft baru · ${c.id}</small></span>
    <span class="q-amt">${c.total ? rp(c.total) : "—"}</span>`;
  const existing = list.querySelector(`li[data-conv="${c.id}"]`);
  if (existing) { existing.innerHTML = inner; return; }
  const li = document.createElement("li");
  li.setAttribute("data-testid", "queue-item");
  li.setAttribute("data-conv", c.id);
  li.setAttribute("data-i", String(idx));
  li.style.cursor = "pointer";
  li.innerHTML = inner;
  list.prepend(li);
}

function sendMessage() {
  const val = composerInput.value.trim();
  if (!val) return;
  const c = convs[currentConv];
  const t = nowHM();
  const { qty, sku, stok } = parseIntent(val);
  const subtotal = qty * sku.unit;
  const ongkir = 18000;
  const total = subtotal + ongkir;

  // 1. Push pesan pelanggan
  c.thread.push(["cust", val, t]);
  c.last = val; c.time = t; c.unread = 0;
  c.state = "understanding";
  composerInput.value = "";
  autoGrow();
  renderConv(currentConv);
  renderStepper(1, { intake: "✓", understanding: `intent tanya_produk 0.92` });

  // 2. check_stock
  setTimeout(() => {
    c.thread.push(["tool", `check_stock(sku=${sku.code}) → tersedia ${stok} pcs`, ""]);
    c.state = "grounding";
    renderConv(currentConv);
    renderStepper(2, { intake: "✓", understanding: "intent tanya_produk 0.92" });
  }, 550);

  // 3. calculate_total
  setTimeout(() => {
    c.thread.push(["tool", `calculate_total(qty=${qty}, sku=${sku.code}) → ${rp(subtotal)} · ongkir JNE REG ${rp(ongkir)}`, ""]);
    c.state = "tool_call";
    renderConv(currentConv);
    renderStepper(3, { intake: "✓", understanding: "intent tanya_produk 0.92" });
  }, 1050);

  // 4. create_draft_order + update queue + toast
  setTimeout(() => {
    c.total = total;
    c.lines = [[`${sku.name} · ${qty} pcs`, subtotal], ["Ongkir JNE REG", ongkir]];
    c.state = "pending_approval";
    c.thread.push(["tool", `create_draft_order(idempotency_key=wa-${c.id || "NEW"}-${t.replace(":","")}) → draft ${c.id} menunggu approval pemilik`, ""]);
    renderConv(currentConv);
    renderStepper(4, { intake: "✓", understanding: "intent tanya_produk 0.92", approval: "⏳" });
    updateQueueForConv(c);
    toast(`Draft ${c.id} · ${rp(total)} · menunggu approval`);
  }, 1600);
}

renderConv(0);

/* ---------- detail approval modal ---------- */
const modal = document.getElementById("modal");
const toastEl = document.getElementById("toast");
const tick = `<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* modal state for countdown & qty edits */
let mState = { convIdx: -1, openedAt: 0, timer: null, lines: [], ongkir: 0 };

function parseQtyFromLabel(label) {
  const m = label.match(/·\s*(\d+)\s*(pcs|box|paket|kaos|biji|item)/i);
  return m ? { qty: parseInt(m[1], 10), unit: m[2], base: label.replace(m[0], "").trim() } : null;
}

function fmtCountdown(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function stopCountdown() {
  if (mState.timer) { clearInterval(mState.timer); mState.timer = null; }
}

function tickCountdown() {
  const elapsedSec = Math.floor((Date.now() - mState.openedAt) / 1000);
  const elapsedMin = elapsedSec / 60;
  document.getElementById("mCountdownTime").textContent = fmtCountdown(elapsedSec);
  const fill = document.getElementById("mCountdownFill");
  fill.style.width = Math.min(100, (elapsedMin / 60) * 100) + "%";
  const stage = document.getElementById("mCountdownStage");
  const timeoutBadge = document.getElementById("mTimeoutBadge");
  fill.className = "";
  if (elapsedMin >= 60) {
    stage.textContent = "auto-hold aktif";
    stage.className = "badge bad";
    fill.style.background = "linear-gradient(90deg,#B4543F,var(--danger))";
    timeoutBadge.hidden = false;
  } else if (elapsedMin >= 30) {
    stage.textContent = "customer notice terkirim";
    stage.className = "badge warn";
    fill.style.background = "linear-gradient(90deg,var(--gold-dim,#B08A38),var(--gold,#D9A94B))";
    timeoutBadge.hidden = true;
  } else if (elapsedMin >= 15) {
    stage.textContent = "reminder ke pemilik";
    stage.className = "badge warn";
    fill.style.background = "linear-gradient(90deg,var(--gold-dim,#B08A38),var(--gold,#D9A94B))";
    timeoutBadge.hidden = true;
  } else {
    stage.textContent = "menunggu approval";
    stage.className = "badge";
    fill.style.background = "linear-gradient(90deg,var(--jade-dim),var(--jade))";
    timeoutBadge.hidden = true;
  }
}

function recomputeModalTotal() {
  let sum = 0;
  mState.lines.forEach(l => { sum += l.qty * l.unitPrice; });
  sum += mState.ongkir;
  document.getElementById("mTotal").textContent = rp(sum);
}

function renderModalLines() {
  const html = mState.lines.map((l, i) => l.editable
    ? `<li data-testid="mline-${i}">
         <span class="mline-name">${l.base}</span>
         <span class="mline-qty">
           <button type="button" class="qty-btn" data-qstep="-1" data-i="${i}" data-testid="mline-qty-dec-${i}" aria-label="Kurangi">−</button>
           <input type="number" min="0" max="999" value="${l.qty}" class="qty-input" data-i="${i}" data-testid="mline-qty-${i}" aria-label="Ubah jumlah" />
           <button type="button" class="qty-btn" data-qstep="1" data-i="${i}" data-testid="mline-qty-inc-${i}" aria-label="Tambah">+</button>
           <small class="mline-unit">${l.unit}</small>
         </span>
         <span class="mline-sub" data-testid="mline-sub-${i}">${rp(l.qty * l.unitPrice)}</span>
       </li>`
    : `<li data-testid="mline-${i}"><span class="mline-name">${l.base}</span><span class="mline-sub">${rp(l.qty * l.unitPrice)}</span></li>`
  ).join("");
  document.getElementById("mLines").innerHTML = html;
  recomputeModalTotal();
}

function openApproval(i) {
  const c = convs[i];
  mState.convIdx = i;
  document.getElementById("mId").textContent = c.id;
  document.getElementById("mCust").textContent = c.n;
  document.getElementById("mAddr").textContent = c.addr;
  document.querySelectorAll(".m-grid b")[1].textContent = c.ch;

  // Build editable lines from c.lines
  mState.lines = [];
  mState.ongkir = 0;
  c.lines.forEach(l => {
    const parsed = parseQtyFromLabel(l[0]);
    if (parsed && parsed.qty > 0) {
      mState.lines.push({ base: parsed.base, qty: parsed.qty, unit: parsed.unit, unitPrice: Math.round(l[1] / parsed.qty), editable: true });
    } else if (/ongkir/i.test(l[0])) {
      mState.ongkir += l[1];
      mState.lines.push({ base: l[0], qty: 1, unit: "", unitPrice: l[1], editable: false });
    } else {
      mState.lines.push({ base: l[0], qty: 1, unit: "", unitPrice: l[1], editable: false });
    }
  });
  renderModalLines();

  document.getElementById("mChecks").innerHTML = [
    "Stok tersedia & terverifikasi dari katalog",
    "Harga cocok dengan kebijakan toko",
    "Tidak terdeteksi duplikat (idempotency key aktif)",
    "Stok baru berkurang setelah Anda menyetujui"
  ].map(t => `<li>${tick}<span>${t}</span></li>`).join("");
  document.getElementById("mApprove").dataset.i = i;

  // Reset reject box
  document.getElementById("mReject").hidden = true;
  document.getElementById("mRejectReason").value = "";
  document.getElementById("mRejectBtn").textContent = "Tolak order";
  document.getElementById("mRejectBtn").classList.remove("confirm-reject");

  // Start countdown
  document.getElementById("mTimeoutBadge").hidden = true;
  stopCountdown();
  mState.openedAt = Date.now();
  tickCountdown();
  mState.timer = setInterval(tickCountdown, 1000);

  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
  stopCountdown();
}

function toast(msg) {
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.hidden = true), 2600);
}

/* qty input handler (modify qty updates mTotal) */
document.getElementById("mLines").addEventListener("input", e => {
  const inp = e.target.closest(".qty-input");
  if (!inp) return;
  const i = +inp.dataset.i;
  const v = Math.max(0, Math.min(999, parseInt(inp.value || "0", 10)));
  mState.lines[i].qty = v;
  document.querySelector(`[data-testid="mline-sub-${i}"]`).textContent = rp(v * mState.lines[i].unitPrice);
  recomputeModalTotal();
});
document.getElementById("mLines").addEventListener("click", e => {
  const b = e.target.closest(".qty-btn");
  if (!b) return;
  const i = +b.dataset.i, step = +b.dataset.qstep;
  const inp = document.querySelector(`.qty-input[data-i="${i}"]`);
  const v = Math.max(0, Math.min(999, (parseInt(inp.value || "0", 10)) + step));
  inp.value = v;
  inp.dispatchEvent(new Event("input", { bubbles: true }));
});

document.addEventListener("click", e => {
  const approveBtn = e.target.closest('[data-testid="draft-approve"]');
  if (approveBtn) { openApproval(+approveBtn.dataset.i); return; }

  const row = e.target.closest('[data-testid="queue-item"]');
  if (row && row.dataset.i !== "") { location.hash = "#inbox"; renderConv(+row.dataset.i); openApproval(+row.dataset.i); return; }

  if (e.target.closest('[data-testid="approve-all-btn"]')) { location.hash = "#inbox"; renderConv(0); openApproval(0); return; }

  // approve
  if (e.target.closest("#mApprove")) {
    const i = +e.target.closest("#mApprove").dataset.i;
    const c = convs[i];
    // Sync total from modal edits back to conversation
    let sum = 0;
    mState.lines.forEach(l => sum += l.qty * l.unitPrice);
    c.total = sum;
    c.state = "approved";
    updateTrxByConvId(c.id, "ok", "Terkonfirmasi");
    renderConv(convs.indexOf(c));
    closeModal();
    toast(`Order ${c.id} disetujui · invoice terkirim`);
    return;
  }

  // reject inside modal → two-step: show textarea then confirm
  const mRejectBtn = e.target.closest('#mRejectBtn');
  if (mRejectBtn) {
    const box = document.getElementById("mReject");
    if (box.hidden) {
      box.hidden = false;
      mRejectBtn.textContent = "Konfirmasi tolak";
      mRejectBtn.classList.add("confirm-reject");
      document.getElementById("mRejectReason").focus();
      return;
    }
    const reason = document.getElementById("mRejectReason").value.trim();
    const c = convs[mState.convIdx];
    c.state = "rejected";
    updateTrxByConvId(c.id, "bad", "Ditolak pemilik");
    renderConv(convs.indexOf(c));
    closeModal();
    toast(reason ? `Order ${c.id} ditolak · alasan: ${reason.slice(0, 60)}` : `Order ${c.id} ditolak — pelanggan dikabari agent`);
    return;
  }

  // backdrop / X close
  if (e.target.closest("[data-close]")) { closeModal(); return; }

  // draft-reject (di panel chat)
  if (e.target.closest('[data-testid="draft-reject"]')) {
    const c = convs[currentConv];
    c.state = "rejected";
    updateTrxByConvId(c.id, "bad", "Ditolak pemilik");
    renderConv(currentConv);
    toast("Draft ditolak — agent minta konfirmasi ulang");
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ---------- knowledge base (mockup) ---------- */
const kbDocs = [
  {
    t: "Daftar Harga Grosir 2025", cat: "Harga", ext: "XLSX", v: 4, chunks: 182,
    upd: "2 jam lalu", st: "ok", stLabel: "Terindeks",
    chunks_txt: [
      ["Keripik Pisang Balado — Rp 29.000/pcs (retail), Rp 27.500/pcs untuk ≥10 pcs, Rp 26.000/pcs untuk reseller ≥20 pcs.", "harga-grosir-2025.xlsx · baris 12"],
      ["Paket Oleh-oleh Mix — Rp 155.000/paket. Tidak berlaku diskon reseller.", "harga-grosir-2025.xlsx · baris 34"],
      ["Harga berlaku sejak 1 Juni 2025 dan menggantikan semua daftar harga sebelumnya.", "harga-grosir-2025.xlsx · catatan"]
    ]
  },
  {
    t: "Kebijakan Reseller & Diskon", cat: "Kebijakan", ext: "PDF", v: 2, chunks: 96,
    upd: "kemarin", st: "ok", stLabel: "Terindeks",
    chunks_txt: [
      ["Diskon reseller 4% berlaku untuk pembelian ≥20 pcs SKU sejenis dalam satu invoice.", "kebijakan-reseller.pdf · hal 2"],
      ["Reseller wajib melakukan pembayaran penuh sebelum barang dikirim. Tidak ada tempo.", "kebijakan-reseller.pdf · hal 3"]
    ]
  },
  {
    t: "Katalog Stok & SKU Aktif", cat: "Stok", ext: "CSV", v: 11, chunks: 324,
    upd: "12 menit lalu", st: "ok", stLabel: "Sinkron live",
    chunks_txt: [
      ["KRP-01 Keripik Pisang Balado — stok 148 pcs, kapasitas 200, gudang Sleman.", "katalog-stok.csv · KRP-01"],
      ["RNG-04 Rengginang Original — stok 11 pcs (kritis), restock masuk hari Kamis.", "katalog-stok.csv · RNG-04"]
    ]
  },
  {
    t: "SOP Pengiriman & Ongkir", cat: "Kebijakan", ext: "DOCX", v: 3, chunks: 141,
    upd: "3 hari lalu", st: "ok", stLabel: "Terindeks",
    chunks_txt: [
      ["JNE REG Rp 18.000 untuk Jawa, estimasi 2–3 hari. Instant courier Rp 20.000 khusus dalam kota Yogyakarta.", "sop-pengiriman.docx · bagian 2"],
      ["Order masuk setelah pukul 15.00 dikirim pada hari kerja berikutnya.", "sop-pengiriman.docx · bagian 4"]
    ]
  },
  {
    t: "Kebijakan Retur & Komplain", cat: "Kebijakan", ext: "PDF", v: 1, chunks: 74,
    upd: "1 minggu lalu", st: "ok", stLabel: "Terindeks",
    chunks_txt: [
      ["Retur hanya diterima maks 2×24 jam setelah barang diterima dengan bukti foto kemasan.", "kebijakan-retur.pdf · hal 1"],
      ["Penggantian barang rusak tidak mengurangi stok jual, dicatat sebagai beban kualitas.", "kebijakan-retur.pdf · hal 2"]
    ]
  },
  {
    t: "Harga Promo Ramadan (draft)", cat: "Harga", ext: "XLSX", v: 1, chunks: 0,
    upd: "baru diunggah", st: "warn", stLabel: "Menunggu indeks",
    chunks_txt: [["Dokumen belum diindeks — agent belum boleh memakai isi dokumen ini sebagai sumber jawaban.", "menunggu proses embedding"]]
  },
  {
    t: "Daftar Harga 2024 (arsip)", cat: "Harga", ext: "PDF", v: 9, chunks: 168,
    upd: "8 bulan lalu", st: "bad", stLabel: "Dinonaktifkan",
    chunks_txt: [["Dokumen kedaluwarsa dan dikeluarkan dari indeks agar agent tidak menjawab dengan harga lama.", "arsip-2024.pdf"]]
  },
  {
    t: "FAQ Pelanggan Toko Ratna", cat: "Stok", ext: "DOCX", v: 5, chunks: 118,
    upd: "hari ini", st: "ok", stLabel: "Terindeks",
    chunks_txt: [
      ["Jika stok kosong, agent menawarkan produk pengganti sejenis dan mencatat permintaan restock.", "faq-pelanggan.docx · Q7"],
      ["Agent tidak menjanjikan tanggal restock kecuali tercantum di katalog stok.", "faq-pelanggan.docx · Q9"]
    ]
  }
];

const kbList = document.getElementById("kbDocs");
let kbFilter = "semua", kbActive = 0;

function kbRender() {
  const shown = kbDocs.map((d, i) => ({ d, i })).filter(x => kbFilter === "semua" || x.d.cat === kbFilter);
  kbList.innerHTML = shown.map(({ d, i }) => `
    <li data-i="${i}" class="${i === kbActive ? "active" : ""}" data-testid="kb-doc-${i}">
      <span class="kb-ico">${d.ext}</span>
      <span class="kb-doc-meta"><b>${d.t}</b><small>${d.cat} · v${d.v} · diperbarui ${d.upd}</small></span>
      <span class="kb-doc-side">
        <span class="mono">${d.chunks} chunk</span>
        <span class="badge ${d.st}">${d.stLabel}</span>
      </span>
    </li>`).join("");
  if (!shown.length) kbList.innerHTML = `<li style="justify-content:center;color:var(--muted)">Tidak ada dokumen pada kategori ini</li>`;
}

function kbPreview(i) {
  kbActive = i;
  const d = kbDocs[i];
  document.getElementById("kbDocTitle").textContent = d.t;
  document.getElementById("kbDocMeta").textContent = `${d.cat} · v${d.v} · diperbarui ${d.upd}`;
  const tag = document.getElementById("kbDocTag");
  tag.textContent = d.stLabel;
  tag.className = "tag" + (d.st === "ok" ? " jade" : "");
  document.getElementById("kbChunks").innerHTML = d.chunks_txt
    .map(c => `<li><p>“${c[0]}”</p><small>${c[1]}</small></li>`).join("");
  kbRender();
}

document.getElementById("kbRules").innerHTML = [
  "Jawaban hanya diambil dari dokumen aktif di Knowledge Base",
  "Setiap harga & stok wajib menyertakan sitasi dokumen sumber",
  "Dokumen arsip atau belum terindeks tidak boleh dipakai",
  "Jika informasi tidak ditemukan, agent bilang tidak tahu & minta konfirmasi pemilik"
].map(t => `<li>${tick}<span>${t}</span></li>`).join("");

kbList.addEventListener("click", e => {
  const li = e.target.closest("li[data-i]");
  if (li) kbPreview(+li.dataset.i);
});

document.querySelectorAll(".kb-chips .chip").forEach(c =>
  c.addEventListener("click", () => { kbFilter = c.dataset.kb; kbRender(); }));

document.querySelector('[data-testid="kb-search-input"]').addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return kbRender();
  kbList.innerHTML = kbDocs.map((d, i) => ({ d, i }))
    .filter(x => (x.d.t + " " + x.d.cat + " " + x.d.chunks_txt.map(c => c[0]).join(" ")).toLowerCase().includes(q))
    .map(({ d, i }) => `
      <li data-i="${i}" class="${i === kbActive ? "active" : ""}" data-testid="kb-doc-${i}">
        <span class="kb-ico">${d.ext}</span>
        <span class="kb-doc-meta"><b>${d.t}</b><small>${d.cat} · v${d.v} · diperbarui ${d.upd}</small></span>
        <span class="kb-doc-side"><span class="mono">${d.chunks} chunk</span><span class="badge ${d.st}">${d.stLabel}</span></span>
      </li>`).join("")
    || `<li style="justify-content:center;color:var(--muted)">Tidak ada hasil untuk “${q}”</li>`;
});

document.querySelector('[data-testid="kb-dropzone"]').addEventListener("click", () =>
  toast("Mockup — unggah dokumen belum aktif"));
document.querySelector('[data-testid="kb-upload-btn"]').addEventListener("click", () =>
  toast("Mockup — unggah dokumen belum aktif"));

kbPreview(0);
