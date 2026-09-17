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

/* ---------- routing ---------- */
const titles = {
  ringkasan: ["Operasional / Ringkasan", "Ringkasan Harian"],
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
  ["Akurasi ekstraksi order", 94, "target ≥ 90%"],
  ["Akurasi stok & harga", 97, "target ≥ 95%"],
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
document.getElementById("queueList").innerHTML = queue.map(q => `
  <li data-testid="queue-item">
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
  <p style="margin:6px 0 0;color:#6C8480;font-size:11.5px">${m[2]}</p></li>`).join("");

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
    `<line x1="${pad}" x2="${W - pad}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.055)"/>
     <text x="0" y="${y(v) + 3}">${v}jt</text>`).join("");
  document.getElementById("lineChart").innerHTML = `
  <svg viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="fillG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2FB98A" stop-opacity=".38"/>
        <stop offset="100%" stop-color="#2FB98A" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="strokeG" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#2FB98A"/><stop offset="100%" stop-color="#F3DFA6"/>
      </linearGradient>
    </defs>
    ${grid}
    <path d="${path} L ${x(omzet.length - 1)} ${H - pad} L ${pad} ${H - pad} Z" fill="url(#fillG)"/>
    <path d="${path}" fill="none" stroke="url(#strokeG)" stroke-width="2.6" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 5 ? 5.5 : 3.4}"
       fill="${i === 5 ? "#F3DFA6" : "#0B1413"}" stroke="#7FE3C0" stroke-width="2"/>`).join("")}
    ${days.map((d, i) => `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${d}</text>`).join("")}
    <text x="${x(5)}" y="${y(omzet[5]) - 14}" text-anchor="middle" fill="#F3DFA6" font-size="11" font-weight="600">Rp 10,6 jt</text>
  </svg>`;
})();

(function bar() {
  const data = [["Snack", 24.6], ["Sambal", 14.2], ["Bundling", 11.1], ["Minuman", 5.3], ["Lainnya", 3.0]];
  const W = 680, H = 250, pad = 40, max = 28, bw = 54;
  const gap = (W - pad * 2 - bw * data.length) / (data.length - 1);
  document.getElementById("barChart").innerHTML = `
  <svg viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="barG" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#1B6B54"/><stop offset="100%" stop-color="#F3DFA6"/></linearGradient></defs>
    ${[0, 7, 14, 21, 28].map(v => { const yy = H - pad - (v / max) * (H - pad * 1.5);
      return `<line x1="${pad}" x2="${W - pad}" y1="${yy}" y2="${yy}" stroke="rgba(255,255,255,.055)"/><text x="0" y="${yy + 3}">${v}jt</text>`; }).join("")}
    ${data.map((d, i) => {
      const h = (d[1] / max) * (H - pad * 1.5), xx = pad + i * (bw + gap), yy = H - pad - h;
      return `<rect x="${xx}" y="${yy}" width="${bw}" height="${h}" rx="9" fill="url(#barG)" opacity=".92"/>
        <text x="${xx + bw / 2}" y="${yy - 9}" text-anchor="middle" fill="#EAF2EF" font-size="11" font-weight="600">${d[1]}jt</text>
        <text x="${xx + bw / 2}" y="${H - 14}" text-anchor="middle">${d[0]}</text>`; }).join("")}
  </svg>`;
})();

/* filter chips (visual only) */
document.querySelectorAll(".chips .chip").forEach(c =>
  c.addEventListener("click", () => {
    c.parentElement.querySelectorAll(".chip").forEach(o => o.classList.remove("active"));
    c.classList.add("active");
  }));
