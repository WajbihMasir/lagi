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
  ["TU-2411", "Wulan Sari", "Keripik Pisang Balado ×12", 348000, "warn", "Pending approval", "09:42"],
  ["TU-2410", "Andi Pratama", "Sambal Roa ×3 box", 195000, "warn", "Pending approval", "09:18"],
  ["TU-2409", "Toko Berkah", "Kacang Telur ×20", 540000, "warn", "Pending approval", "08:55"],
  ["TU-2408", "Nabila Putri", "Rengginang ×6", 174000, "ok", "Terkonfirmasi", "08:31"],
  ["TU-2407", "Hendra Wijaya", "Keripik Tempe ×10", 270000, "ok", "Terkonfirmasi", "08:04"],
  ["TU-2406", "Rizky Hidayat", "Retur kemasan rusak", -62000, "bad", "Ditolak agent", "07:47"],
  ["TU-2405", "Sinta Maulida", "Paket Oleh-oleh ×2", 310000, "ok", "Terkonfirmasi", "07:22"]
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

document.getElementById("trxTable").innerHTML = `
  <thead><tr><th>ID</th><th>Pelanggan</th><th>Ringkasan order</th><th>Nilai</th><th>Status</th><th>Jam</th></tr></thead>
  <tbody>${trx.map(r => `<tr>
    <td class="mono">${r[0]}</td><td class="strong">${r[1]}</td><td>${r[2]}</td>
    <td class="strong">${rp(r[3])}</td><td><span class="badge ${r[4]}">${r[5]}</span></td>
    <td class="mono">${r[6]}</td></tr>`).join("")}</tbody>`;

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
  const W = 680, H = 230, pad = 34, max = 12;
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
  const W = 680, H = 250, pad = 40, max = 28, bw = 54;
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

/* filter chips (visual only) */
document.querySelectorAll(".chips .chip").forEach(c =>
  c.addEventListener("click", () => {
    c.parentElement.querySelectorAll(".chip").forEach(o => o.classList.remove("active"));
    c.classList.add("active");
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
  const c = convs[i];
  document.getElementById("chatAvatar").textContent = c.ini;
  document.getElementById("chatName").textContent = c.n;
  document.getElementById("chatMeta").textContent = `${c.ch} · ${c.phone}`;
  const st = document.querySelector('[data-testid="chat-state"]');
  st.textContent = "state: " + c.state;
  st.className = "badge " + (c.state === "pending_approval" ? "warn" : "ok");

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
}
convList.addEventListener("click", e => {
  const li = e.target.closest("li"); if (li) renderConv(+li.dataset.i);
});
renderConv(0);

/* ---------- detail approval modal ---------- */
const modal = document.getElementById("modal");
const toastEl = document.getElementById("toast");
const tick = `<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function openApproval(i) {
  const c = convs[i];
  document.getElementById("mId").textContent = c.id;
  document.getElementById("mCust").textContent = c.n;
  document.getElementById("mAddr").textContent = c.addr;
  document.querySelectorAll(".m-grid b")[1].textContent = c.ch;
  document.getElementById("mTotal").textContent = rp(c.total);
  document.getElementById("mLines").innerHTML =
    c.lines.map(l => `<li><span>${l[0]}</span><span>${rp(l[1])}</span></li>`).join("");
  document.getElementById("mChecks").innerHTML = [
    "Stok tersedia & terverifikasi dari katalog",
    "Harga cocok dengan kebijakan toko",
    "Tidak terdeteksi duplikat (idempotency key aktif)",
    "Stok baru berkurang setelah Anda menyetujui"
  ].map(t => `<li>${tick}<span>${t}</span></li>`).join("");
  document.getElementById("mApprove").dataset.i = i;
  modal.hidden = false;
}
function toast(msg) {
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.hidden = true), 2600);
}

document.addEventListener("click", e => {
  const approveBtn = e.target.closest('[data-testid="draft-approve"]');
  if (approveBtn) { openApproval(+approveBtn.dataset.i); return; }

  const row = e.target.closest('[data-testid="queue-item"]');
  if (row && row.dataset.i !== "") { location.hash = "#inbox"; renderConv(+row.dataset.i); openApproval(+row.dataset.i); return; }

  if (e.target.closest('[data-testid="approve-all-btn"]')) { location.hash = "#inbox"; renderConv(0); openApproval(0); return; }

  if (e.target.closest("[data-close]")) {
    modal.hidden = true;
    if (e.target.closest('[data-testid="approval-reject"]')) toast("Order ditolak — pelanggan dikabari agent");
    return;
  }
  if (e.target.closest("#mApprove")) {
    const c = convs[+e.target.closest("#mApprove").dataset.i];
    modal.hidden = true;
    c.state = "approved";
    renderConv(convs.indexOf(c));
    toast(`Order ${c.id} disetujui · invoice terkirim`);
  }
  if (e.target.closest('[data-testid="draft-reject"]')) toast("Draft ditolak — agent minta konfirmasi ulang");
});
document.addEventListener("keydown", e => { if (e.key === "Escape") modal.hidden = true; });
