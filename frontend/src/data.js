/* ---------- mock data (kept identical to /public/mockup/app.js:48+) ---------- */

export const rp = (n) => "Rp " + n.toLocaleString("id-ID");

// baseline "hari ini" (line 48) — 7 hari terakhir
export const omzet = [6.2, 7.8, 7.1, 8.9, 8.2, 10.6, 9.4];
export const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/* Period variants — data mock berbeda per periode agar chart benar-benar berganti */
export const PERIODS = {
  today: {
    label: "Hari ini",
    omzet: [6.2, 7.8, 7.1, 8.9, 8.2, 10.6, 9.4],
    kategori: [
      { name: "Snack", value: 24.6 },
      { name: "Sambal", value: 14.2 },
      { name: "Bundling", value: 11.1 },
      { name: "Minuman", value: 5.3 },
      { name: "Lainnya", value: 3.0 },
    ],
    intent: [
      { name: "Tanya Produk", value: 38 },
      { name: "Pesan Order", value: 32 },
      { name: "Cek Stok", value: 18 },
      { name: "Retur", value: 6 },
      { name: "Lainnya", value: 6 },
    ],
    response: [
      { hour: "06", ms: 820 },
      { hour: "08", ms: 640 },
      { hour: "10", ms: 480 },
      { hour: "12", ms: 720 },
      { hour: "14", ms: 560 },
      { hour: "16", ms: 410 },
      { hour: "18", ms: 380 },
      { hour: "20", ms: 520 },
    ],
    total: "Rp 9,4 jt",
  },
  week: {
    label: "7 hari",
    omzet: [5.4, 6.1, 7.3, 6.8, 8.4, 9.1, 10.2],
    kategori: [
      { name: "Snack", value: 42.1 },
      { name: "Sambal", value: 24.8 },
      { name: "Bundling", value: 18.6 },
      { name: "Minuman", value: 9.2 },
      { name: "Lainnya", value: 4.5 },
    ],
    intent: [
      { name: "Tanya Produk", value: 41 },
      { name: "Pesan Order", value: 34 },
      { name: "Cek Stok", value: 14 },
      { name: "Retur", value: 5 },
      { name: "Lainnya", value: 6 },
    ],
    response: [
      { hour: "Sen", ms: 610 },
      { hour: "Sel", ms: 720 },
      { hour: "Rab", ms: 520 },
      { hour: "Kam", ms: 470 },
      { hour: "Jum", ms: 690 },
      { hour: "Sab", ms: 830 },
      { hour: "Min", ms: 940 },
    ],
    total: "Rp 58,2 jt",
  },
  month: {
    label: "30 hari",
    omzet: [22.4, 26.1, 24.8, 28.9, 31.2, 29.5, 34.1],
    kategori: [
      { name: "Snack", value: 128.4 },
      { name: "Sambal", value: 74.3 },
      { name: "Bundling", value: 61.7 },
      { name: "Minuman", value: 28.4 },
      { name: "Lainnya", value: 14.9 },
    ],
    intent: [
      { name: "Tanya Produk", value: 44 },
      { name: "Pesan Order", value: 30 },
      { name: "Cek Stok", value: 12 },
      { name: "Retur", value: 7 },
      { name: "Lainnya", value: 7 },
    ],
    response: [
      { hour: "W1", ms: 740 },
      { hour: "W2", ms: 620 },
      { hour: "W3", ms: 580 },
      { hour: "W4", ms: 640 },
      { hour: "W5", ms: 490 },
    ],
    total: "Rp 187,6 jt",
  },
};

export const queue = [
  { n: "Wulan Sari", d: "12 pcs Keripik Pisang · Balado", a: 348000, s: "" },
  { n: "Andi Pratama", d: "3 box Sambal Roa · pedas", a: 195000, s: "" },
  { n: "Dewi Lestari", d: "Tanya stok Rengginang 5kg", a: 0, s: "jade" },
  { n: "Toko Berkah", d: "20 pcs Kacang Telur · reseller", a: 540000, s: "" },
  { n: "Rizky Hidayat", d: "Retur 2 pcs — kemasan rusak", a: -62000, s: "red" },
  { n: "Sinta Maulida", d: "8 pcs Keripik Tempe · original", a: 216000, s: "" },
];

export const initialTrx = [
  ["TU-2411", "Wulan Sari", "Keripik Pisang Balado ×12", 348000, "warn", "Pending approval", 2, false, "wa-9087-0942"],
  ["TU-2410", "Andi Pratama", "Sambal Roa ×3 box", 195000, "warn", "Pending approval", 26, true, "wa-2210-0918"],
  ["TU-2409", "Toko Berkah", "Kacang Telur ×20", 540000, "warn", "Pending approval", 49, false, "wa-3390-0855"],
  ["TU-2408", "Nabila Putri", "Rengginang ×6", 174000, "ok", "Terkonfirmasi", 73, false, "wa-1188-0831"],
  ["TU-2407", "Hendra Wijaya", "Keripik Tempe ×10", 270000, "ok", "Terkonfirmasi", 100, true, "wa-4423-0804"],
  ["TU-2406", "Rizky Hidayat", "Retur kemasan rusak", -62000, "bad", "Ditolak agent", 117, false, "wa-9917-0747"],
  ["TU-2405", "Sinta Maulida", "Paket Oleh-oleh ×2", 310000, "ok", "Terkonfirmasi", 142, false, "wa-2044-0722"],
];

export const prod = [
  ["KRP-01", "Keripik Pisang Balado", "Snack", 29000, 148, 200],
  ["SRO-02", "Sambal Roa Pedas", "Sambal", 65000, 24, 150],
  ["KCT-03", "Kacang Telur Gurih", "Snack", 27000, 96, 180],
  ["RNG-04", "Rengginang Original", "Snack", 29000, 11, 160],
  ["KTP-05", "Keripik Tempe Original", "Snack", 27000, 212, 250],
  ["PKO-06", "Paket Oleh-oleh Mix", "Bundling", 155000, 8, 60],
];

export const metrics = [
  ["Akurasi ekstraksi order", 94, "target ≥ 90%"],
  ["Akurasi stok & harga", 97, "target ≥ 95%"],
  ["Completion rate", 91, "target ≥ 85%"],
  ["Grounding rate", 88, "target ≥ 80%"],
  ["Intervensi manual", 7, "target ≤ 15%"],
];

export const rep = [
  ["Minggu 1", 312, 12400000, "94%", "6%"],
  ["Minggu 2", 358, 14900000, "95%", "5%"],
  ["Minggu 3", 341, 13850000, "93%", "8%"],
  ["Minggu 4", 396, 17050000, "96%", "7%"],
];

export const initialConvs = [
  {
    id: "TU-2411", n: "Wulan Sari", ini: "WS", ch: "WhatsApp", phone: "+62 812-3344-9087",
    last: "Oke bu, total berapa ya?", time: "09:42", unread: 2, state: "pending_approval",
    total: 348000,
    thread: [
      ["cust", "Bu, keripik pisang yg balado masih ada? mau 12 pcs", "09:38"],
      ["tool", "check_stock(sku=KRP-01) → tersedia 148 pcs", ""],
      ["agent", "Halo Kak Wulan 👋 Keripik Pisang Balado tersedia (stok 148 pcs). Harga Rp 27.500/pcs untuk pembelian ≥10 pcs.", "09:39"],
      ["cust", "Oke bu, total berapa ya? kirim ke Jl. Kaliurang 21 Sleman", "09:40"],
      ["agent", "Totalnya Rp 348.000 (12 pcs = Rp 330.000 + ongkir Rp 18.000). Saya siapkan draft pesanannya dulu ya Kak.", "09:41"],
    ],
  },
  {
    id: "TU-2410", n: "Andi Pratama", ini: "AP", ch: "WhatsApp", phone: "+62 813-8891-2210",
    last: "3 box sambal roa yg pedas ya", time: "09:18", unread: 1, state: "pending_approval",
    total: 195000,
    thread: [
      ["cust", "3 box sambal roa yg pedas ya bu", "09:15"],
      ["agent", "Siap Kak Andi, Sambal Roa Pedas 3 box = Rp 195.000.", "09:16"],
    ],
  },
  {
    id: "—", n: "Dewi Lestari", ini: "DL", ch: "Instagram", phone: "@dewi.lestari",
    last: "Rengginang 5kg ready kak?", time: "08:57", unread: 0, state: "answered",
    total: 0,
    thread: [
      ["cust", "Rengginang 5kg ready kak?", "08:55"],
      ["agent", "Stok tinggal 11 pcs Kak, belum cukup 5kg. Restock masuk Kamis, mau saya kabari saat ready?", "08:56"],
    ],
  },
  {
    id: "TU-2409", n: "Toko Berkah", ini: "TB", ch: "WhatsApp", phone: "+62 856-7712-3390",
    last: "Kacang telur 20 pcs harga reseller", time: "08:55", unread: 1, state: "pending_approval",
    total: 540000,
    thread: [
      ["cust", "Kacang telur 20 pcs harga reseller ya", "08:50"],
      ["agent", "20 pcs dapat harga Rp 26.000/pcs = Rp 520.000 + ongkir instant Rp 20.000.", "08:52"],
    ],
  },
];

/* Knowledge Base — mock RAG documents (nama, ukuran, terakhir sinkron) */
export const KB_DOCS = [
  {
    id: "kb-01",
    name: "Katalog Produk & Harga 2026.pdf",
    kind: "PDF",
    size: "412 KB",
    chunks: 184,
    lastSync: "Hari ini · 07:20",
    status: "synced",
    tag: "harga",
  },
  {
    id: "kb-02",
    name: "SOP Balas Chat Pelanggan.md",
    kind: "MD",
    size: "38 KB",
    chunks: 42,
    lastSync: "Hari ini · 06:55",
    status: "synced",
    tag: "sop",
  },
  {
    id: "kb-03",
    name: "FAQ Reseller & Grosir.docx",
    kind: "DOCX",
    size: "91 KB",
    chunks: 76,
    lastSync: "Kemarin · 21:12",
    status: "synced",
    tag: "reseller",
  },
  {
    id: "kb-04",
    name: "Kebijakan Retur & Komplain.pdf",
    kind: "PDF",
    size: "128 KB",
    chunks: 58,
    lastSync: "2 hari lalu · 10:04",
    status: "synced",
    tag: "kebijakan",
  },
  {
    id: "kb-05",
    name: "Tarif Ongkir Ekspedisi.xlsx",
    kind: "XLSX",
    size: "76 KB",
    chunks: 63,
    lastSync: "3 hari lalu · 16:38",
    status: "syncing",
    tag: "ongkir",
  },
  {
    id: "kb-06",
    name: "Bundling & Promo Berjalan.pdf",
    kind: "PDF",
    size: "204 KB",
    chunks: 91,
    lastSync: "3 hari lalu · 08:22",
    status: "synced",
    tag: "promo",
  },
  {
    id: "kb-07",
    name: "Skrip Follow-up Pesanan.md",
    kind: "MD",
    size: "22 KB",
    chunks: 27,
    lastSync: "5 hari lalu · 09:11",
    status: "synced",
    tag: "sop",
  },
  {
    id: "kb-08",
    name: "Jadwal Restock Mingguan.csv",
    kind: "CSV",
    size: "12 KB",
    chunks: 19,
    lastSync: "1 minggu lalu · 12:47",
    status: "stale",
    tag: "stok",
  },
];

/* Quick reply chips di atas composer */
export const QUICK_REPLIES = [
  {
    key: "konfirmasi",
    label: "Konfirmasi order",
    text: "Baik Kak, pesanannya sudah kami konfirmasi ya. Terima kasih! 🙏",
  },
  {
    key: "alamat",
    label: "Minta alamat",
    text: "Boleh dibantu kirim alamat lengkap + nomor HP penerima ya, Kak?",
  },
  {
    key: "ongkir",
    label: "Info ongkir",
    text: "Untuk ongkir, boleh info kota/kecamatan tujuannya dulu Kak, biar saya cek tarif ekspedisi terbaiknya.",
  },
  {
    key: "pembayaran",
    label: "Info pembayaran",
    text: "Pembayaran bisa via transfer BCA / Mandiri / QRIS ya Kak. Nomor rekening akan saya kirim setelah invoice dibuat.",
  },
];

/* Synthetic Demo Controls — 3 flows */
export const DEMO_FLOWS = {
  flow1: {
    label: "Flow 1 · Tanya",
    conv: {
      id: "DEMO-TANYA-" + Math.floor(Math.random() * 900 + 100),
      n: "Cika Ramadhani", ini: "CR", ch: "WhatsApp", phone: "+62 811-2020-5566",
      last: "Kak, keripik tempe ada varian pedas?", time: "now", unread: 1, state: "answered",
      total: 0,
      thread: [
        ["cust", "Kak, keripik tempe ada varian pedas?", "now"],
        ["tool", "kb_lookup(topic=varian_produk) → Keripik Tempe: Original, Balado, Pedas Manis", ""],
        ["agent", "Ada Kak — Keripik Tempe tersedia varian Original, Balado, dan Pedas Manis. Semua Rp 27.000/pcs.", "now"],
      ],
    },
  },
  flow2: {
    label: "Flow 2 · Pesan",
    conv: {
      id: "TU-" + Math.floor(2500 + Math.random() * 99),
      n: "Ahmad Fauzi", ini: "AF", ch: "WhatsApp", phone: "+62 819-3311-7788",
      last: "Order 5 paket oleh-oleh mix ya", time: "now", unread: 2, state: "pending_approval",
      total: 795000,
      thread: [
        ["cust", "Order 5 paket oleh-oleh mix ya kak", "now"],
        ["tool", "check_stock(sku=PKO-06) → sisa 8 paket", ""],
        ["tool", "calculate_total(qty=5, sku=PKO-06) → Rp 775.000 · ongkir Rp 20.000", ""],
        ["agent", "Siap Kak, 5 paket = Rp 775.000 + ongkir Rp 20.000 = Rp 795.000. Draft dibuat, menunggu approval pemilik.", "now"],
      ],
    },
  },
  flow3: {
    label: "Flow 3 · Timeout",
    conv: {
      id: "TU-" + Math.floor(2500 + Math.random() * 99),
      n: "Bu Marni", ini: "BM", ch: "WhatsApp", phone: "+62 822-4400-1122",
      last: "Halo mbak, mau order tapi belum di-approve nih", time: "now", unread: 3, state: "pending_approval",
      total: 462000,
      thread: [
        ["cust", "Mbak, mau order kacang telur 15 pcs", "60m ago"],
        ["agent", "Baik Kak, saya siapkan draft. Menunggu approval pemilik ya.", "59m ago"],
        ["cust", "Kok belum dibales lagi ya mbak?", "30m ago"],
        ["tool", "customer_notice_sent → auto-notify pelanggan", ""],
        ["cust", "Halo mbak, mau order tapi belum di-approve nih", "now"],
        ["tool", "auto_hold_activated → escalate ke pemilik", ""],
      ],
    },
  },
};
