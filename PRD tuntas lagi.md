# 📋 PRD — Proyek TuntasUMKM
## AI Operational Agent untuk Otomasi Penjualan & Dukungan UMKM Indonesia
**Versi:** 1.0.0 | **Tanggal:** Agustus 2026 | **Kategori Kompetisi:** Business Automation — IDwebhost AI HackFest 2026

---

## 1. Ringkasan Eksekutif

**TuntasUMKM** adalah AI Operational Agent yang mengkonversi percakapan pelanggan menjadi workflow terstruktur dan tereksekusi secara otomatis — mulai dari menjawab pertanyaan produk, memproses pesanan, hingga menghasilkan laporan analitik — semuanya dari satu interface chat.

**Problem Statement:** 64% pelaku UMKM Indonesia menghabiskan 3-5 jam/hari untuk membalas chat pelanggan secara repetitif (FAQ produk, cek stok, proses pesanan). Ini bukan masalah informasi — ini masalah *operasional* yang menghambat pertumbuhan bisnis.

**Solusi:** Bukan chatbot biasa. TuntasUMKM adalah *Operational Agent* — AI yang tidak hanya menjawab, tapi **bertindak**: mengecek stok real-time, membuat draft pesanan, menghitung total harga, dan mengeksekusi tindakan setelah persetujuan pemilik (Human-in-the-Loop).

**Diferensiasi Kunci vs Chatbot Konvensional:**
| Aspek | Chatbot Biasa | TuntasUMKM |
|---|---|---|
| Output | Teks jawaban | Teks + Aksi (order, update stok) |
| Pengetahuan | Scripted/FAQ | RAG dari katalog produk dinamis |
| Keputusan Kritis | Auto atau manual penuh | HITL — approval gate otomatis |
| Observabilitas | Tidak ada | Full trace per workflow step |
| Idempotency | Tidak dihandle | Dedup key per customer message |

---

## 2. Target Pengguna

### Primary: Pemilik UMKM Indonesia
- Mengelola toko online via WhatsApp/marketplace
- Menerima 20-100+ chat pelanggan per hari
- Tidak punya tim CS dedicated
- Familiar dengan smartphone, kurang familiar dengan tools enterprise

### Secondary: Pelanggan UMKM
- Bertanya tentang produk, harga, stok, dan cara pemesanan
- Mengharapkan respons cepat dan akurat
- Komunikasi dalam Bahasa Indonesia (termasuk bahasa informal/slang)

### Tertiary (Konteks Kompetisi): Juri AI HackFest 2026
- Menilai: relevansi masalah, kreativitas, kualitas teknis, kualitas komunikasi
- Menginginkan demo yang *berjalan nyata*, bukan slide deck

---

## 3. Arsitektur Workflow — 7 Stage Pipeline

Setiap pesan pelanggan melewati pipeline deterministik berikut:

```
Customer Message
       │
       ▼
┌─────────────┐
│  1. INTAKE   │ → Normalisasi pesan, dedup check, session binding
└──────┬──────┘
       ▼
┌─────────────────┐
│ 2. UNDERSTANDING │ → Intent classification + entity extraction (NLU)
└──────┬──────────┘
       ▼
┌──────────────┐
│ 3. GROUNDING  │ → RAG retrieval dari katalog produk + validasi stok real-time
└──────┬───────┘
       ▼
┌──────────────┐
│ 4. TOOL CALL  │ → Eksekusi tool: cek_stok, buat_pesanan, hitung_harga, dll.
└──────┬───────┘
       ▼
┌──────────────┐
│ 5. APPROVAL   │ → HITL gate: notif ke pemilik untuk aksi berisiko
└──────┬───────┘
       ▼
┌──────────────┐
│ 6. RESPONSE   │ → Generate respons natural ke pelanggan
└──────┬───────┘
       ▼
┌───────────────┐
│ 7. ANALYTICS   │ → Log structured event, update dashboard metrics
└───────────────┘
```

### Detail Per Stage:

**Stage 1 — Intake**
- Normalisasi teks (lowercase, typo correction ringan)
- **Idempotency check**: Hash (customer_id + message_text + 5min_window) → tolak duplikat
- Session binding: Attach/create session berdasarkan customer_id
- Rate limiting: Max 10 messages/minute per customer

**Stage 2 — Understanding**
- Multi-label intent classification:
  - `tanya_produk` | `tanya_stok` | `mau_pesan` | `keluhan` | `lainnya`
- Entity extraction: nama_produk, jumlah, varian, alamat
- Confidence threshold: < 0.6 → trigger clarification prompt
- Bahasa: Support Bahasa Indonesia formal + informal (gue/gw, mau dong, dll.)

**Stage 3 — Grounding**
- **Hybrid RAG**: Dense vector search (semantic) + BM25 (exact match untuk SKU/nama produk)
- Reciprocal Rank Fusion (RRF) untuk merge hasil
- Chunk strategy: Per product variant (termasuk harga, stok, deskripsi, varian)
- **Conflict Resolution**: Jika RAG data ≠ real-time DB → DB menang (stok/harga), RAG menang (deskripsi)
- Cross-encoder reranker untuk top-10 candidates

**Stage 4 — Tool Call**
- Tools tersedia:
  - `cek_stok(product_id)` → return stok real-time dari DB
  - `buat_draft_pesanan(customer_id, items[])` → return draft order + total harga
  - `hitung_ongkir(alamat, berat)` → estimasi ongkos kirim
  - `update_stok(product_id, delta)` → post-approval stock adjustment
  - `kirim_notifikasi(owner_id, message)` → push notif ke pemilik
- Setiap tool call di-log dengan trace_id untuk observabilitas
- Tool call bersifat *idempotent* — duplicate call dengan parameter sama tidak mengubah state

**Stage 5 — Approval (HITL)**
- **Trigger condition**: Aksi yang mengubah state (buat pesanan, update stok, refund)
- Aksi read-only (cek stok, tanya produk) → bypass approval, langsung Stage 6
- **Approval flow**:
  1. Agent kirim notifikasi ke pemilik via dashboard + push notification
  2. Pemilik approve/reject/modify via dashboard
  3. **Timeout policy**: 15 menit → auto-escalate reminder. 30 menit → kirim pesan ke pelanggan: "Pesanan Anda sedang diproses, kami akan konfirmasi segera"
  4. **60 menit tanpa respons** → auto-hold + log ke analytics sebagai "approval_timeout"
- **TIDAK ada auto-approve** untuk MVP — semua aksi state-changing butuh human approval (keamanan > kecepatan untuk UMKM)

**Stage 6 — Response**
- Generate respons natural Bahasa Indonesia
- Template-aware: Sertakan detail pesanan dalam format terstruktur jika applicable
- Tone: Ramah, profesional, tidak terlalu formal
- Fallback: Jika generation gagal → kirim template statis yang relevan

**Stage 7 — Analytics**
- Setiap workflow run menghasilkan structured event:
  ```json
  {
    "trace_id": "uuid",
    "customer_id": "string",
    "intent": "mau_pesan",
    "tools_called": ["cek_stok", "buat_draft_pesanan"],
    "approval_status": "approved",
    "response_time_ms": 2340,
    "timestamp": "ISO8601"
  }
  ```
- Dashboard metrics:
  - Total percakapan / hari
  - Intent distribution (pie chart)
  - Avg. response time
  - Approval rate & avg. approval time
  - Top 10 produk ditanyakan
  - Revenue dari pesanan yang diproses agent

---

## 4. Fitur Inti (MVP Scope)

### F1: Chat Interface — Web Inbox Simulator
- Web-based chat widget yang mensimulasikan percakapan pelanggan
- Mendukung multiple concurrent customer sessions
- Untuk demo: synthetic customer personas yang mengirim pesan realistis
- **Kenapa Web, bukan WhatsApp live**: Kontrol penuh untuk demo, tidak bergantung pada API third-party yang bisa down saat presentasi

### F2: AI Agent Pipeline (7-Stage)
- Full implementation dari pipeline di Section 3
- Observable: Setiap stage menampilkan status di dashboard owner (like a Kanban)
- Error handling: Jika stage gagal → graceful fallback + log

### F3: RAG Product Knowledge
- Ingest katalog produk dari CSV/JSON upload
- Embedding via model multilingual
- Hybrid search (vector + BM25)
- Real-time stock validation layer

### F4: Owner Dashboard
- Approval queue dengan notifikasi real-time
- Conversation monitor (bisa lihat semua chat aktif)
- Analytics dashboard dengan charts
- Product catalog management (CRUD)

### F5: Human-in-the-Loop Approval Gate
- Real-time notification ke dashboard
- Approve/Reject/Modify dengan satu klik
- Timeout handling (15min reminder, 30min customer notice, 60min auto-hold)
- Audit trail semua keputusan

### F6: Analytics & Reporting
- Real-time dashboard metrics
- Daily summary auto-generated
- Exportable ke CSV
- Trend analysis (mingguan)

---

## 5. Tech Stack

### Frontend
- **React + TypeScript** — SPA untuk Owner Dashboard + Chat Widget
- **Tailwind CSS** — Rapid UI styling
- **Recharts** — Charting library untuk analytics dashboard
- **Socket.io Client** — Real-time updates (approval notifications, live chat)

### Backend
- **FastAPI (Python)** — API server utama
- **Socket.io (python-socketio)** — WebSocket layer untuk real-time
- **Celery + Redis** — Task queue untuk async workflow stages
- **LangChain / LlamaIndex** — RAG orchestration layer

### Agent Framework
- **Hermes Agent** (Rekomendasi)
  - Multi-agent Kanban topology cocok untuk 7-stage pipeline
  - Built-in persistent memory
  - 60+ built-in tools, extensible via plugin
  - Kenapa bukan OpenClaw: OpenClaw lebih cocok untuk personal agent; Hermes lebih cocok untuk business workflow orchestration dengan multi-agent DAG

### AI Models (Cascade Strategy)
- **Primary**: Model default kompetisi (jika disediakan IDwebhost)
- **Fallback 1**: Claude Sonnet 4.6 — balance kecepatan + kualitas untuk NLU + generation
- **Fallback 2**: GPT 5.4 Mini — cost-efficient untuk high-volume intent classification
- **Embedding**: text-embedding-3-small (OpenAI) atau Cohere embed-multilingual-v3.0

### Database
- **MongoDB** — Primary datastore
  - Collections: `customers`, `products`, `orders`, `conversations`, `workflow_traces`, `approvals`, `analytics_events`
  - MongoDB Atlas Search untuk BM25 component dari hybrid search

### Vector Store
- **MongoDB Atlas Vector Search** — Unified stack, tidak perlu DB terpisah untuk vector
  - Menyimpan product embeddings langsung di MongoDB
  - Mengurangi operational complexity untuk demo

### Infrastructure
- **Redis** — Cache layer + Celery broker + session store + dedup cache
- **Docker Compose** — Single-command deployment untuk demo

---

## 6. Data Strategy

### Untuk MVP/Demo: Synthetic Data
- 50 produk UMKM realistis (fashion, F&B, kerajinan) dengan:
  - Nama, deskripsi, harga, stok, varian, gambar placeholder
- 10 customer personas dengan pola chat berbeda:
  - Pelanggan tegas ("Mau pesan 3 kaos ukuran L")
  - Pelanggan eksplorasi ("Ada apa aja sih?")
  - Pelanggan komplain ("Barang belum sampai")
  - Pelanggan informal ("kak ada ready ga yg warna ijo")
- Script automated customer messages untuk demo flow

### Database Schema (MongoDB Collections)

```javascript
// products
{
  _id: ObjectId,
  sku: "KAOS-001-L-HITAM",
  name: "Kaos Polos Premium",
  description: "Kaos cotton combed 30s, jahitan rantai...",
  price: 89000,
  stock: 45,
  variants: [{ size: "L", color: "Hitam", stock: 15 }],
  category: "Fashion",
  embedding: [0.012, -0.034, ...], // vector embedding
  updated_at: ISODate
}

// orders
{
  _id: ObjectId,
  order_id: "ORD-20260815-001",
  customer_id: ObjectId,
  items: [{ product_id: ObjectId, qty: 2, unit_price: 89000 }],
  total: 178000,
  status: "pending_approval" | "approved" | "rejected" | "completed",
  approval_trace: {
    requested_at: ISODate,
    responded_at: ISODate,
    decision: "approved",
    modified_by: "owner"
  },
  trace_id: "uuid",
  created_at: ISODate
}

// workflow_traces
{
  _id: ObjectId,
  trace_id: "uuid",
  customer_id: ObjectId,
  stages: [
    { name: "intake", status: "completed", duration_ms: 120, metadata: {} },
    { name: "understanding", status: "completed", duration_ms: 450, metadata: { intent: "mau_pesan", confidence: 0.92 } },
    // ... semua 7 stages
  ],
  total_duration_ms: 2340,
  created_at: ISODate
}
```

---

## 7. User Flow

### Flow 1: Pelanggan Tanya Produk (Read-Only — No Approval)
```
Pelanggan: "Kak ada kaos polos warna hitam ga?"
  → Intake: Normalize, dedup check ✓
  → Understanding: intent=tanya_produk, entity={produk: kaos polos, warna: hitam}
  → Grounding: RAG search → found 3 matching products
  → Tool Call: cek_stok("KAOS-001-L-HITAM") → 15 tersedia
  → Approval: SKIP (read-only)
  → Response: "Hai kak! Kaos Polos Premium warna Hitam ready stock ya. Tersedia ukuran S/M/L/XL. Harga Rp89.000. Mau pesan berapa kak?"
  → Analytics: Log event
```

### Flow 2: Pelanggan Mau Pesan (State-Changing — Requires Approval)
```
Pelanggan: "Mau pesan 3 kaos hitam ukuran L"
  → Intake → Understanding: intent=mau_pesan, entities extracted
  → Grounding: Validasi produk exist + stok cukup
  → Tool Call: buat_draft_pesanan → draft order Rp267.000
  → Approval: 🔔 Notifikasi ke Owner Dashboard
     Owner melihat: "Pesanan baru: 3x Kaos Polos Hitam L = Rp267.000"
     Owner klik [Approve]
  → Response: "Pesanan kamu sudah dikonfirmasi kak! Total Rp267.000. Silakan transfer ke [rekening]. Kirim bukti transfer ya 🙏"
  → Analytics: Log order_created event
```

### Flow 3: Approval Timeout
```
  → Approval: 🔔 Notif ke Owner... tidak ada respons
  → 15 menit: Reminder notif ke Owner
  → 30 menit: Auto-response ke pelanggan: "Pesanan kamu sedang diproses kak, mohon tunggu ya. Kami akan konfirmasi segera."
  → 60 menit: Auto-hold, log approval_timeout
  → Analytics: Flag di dashboard sebagai bottleneck
```

---

## 8. Strategi Kemenangan Hackathon

Berdasarkan 4 kriteria juri IDwebhost AI HackFest 2026:

### 8.1 Relevansi Masalah (Problem Relevance)
- Masalah nyata: 64 juta UMKM Indonesia, mayoritas pakai WhatsApp sebagai channel utama
- Data pendukung: Rata-rata 3-5 jam/hari dihabiskan untuk membalas chat
- Impact terukur: Estimasi penghematan 60-70% waktu CS, response time dari menit ke detik

### 8.2 Kreativitas (Creativity)
- **Bukan chatbot, tapi Operational Agent** — diferensiasi jelas
- **7-Stage Observable Pipeline** — transparan, auditable, setiap stage bisa di-debug
- **HITL yang Pragmatis** — bukan binary auto/manual, tapi graduated timeout dengan fallback
- **Conflict Resolution RAG vs DB** — menunjukkan kedalaman thinking tentang edge cases
- **Idempotency Layer** — menunjukkan production-readiness mindset

### 8.3 Kualitas Teknis (Technical Quality)
- Full-stack implementation (Frontend + Backend + AI + Database)
- Observable architecture (setiap stage punya trace)
- Error handling yang terencana (fallback di setiap stage)
- Hybrid RAG (bukan sekedar vector search)
- Proper data modeling (MongoDB schema yang didesain)

### 8.4 Kualitas Komunikasi (Communication Quality)
- Demo video 3-5 menit harus menunjukkan:
  1. Problem statement dengan data (30 detik)
  2. Live demo: 3 flow (tanya produk, pesan, timeout) (2.5 menit)
  3. Dashboard analytics walk-through (1 menit)
  4. Architecture diagram + diferensiasi (1 menit)
- Artikel 800+ kata: Structured dengan heading, diagram, dan metrics

---

## 9. Deliverables Kompetisi

| Deliverable | Spec | Status |
|---|---|---|
| Demo Video | 3-5 menit, YouTube/GDrive public | TODO |
| Artikel Proyek | Min 800 kata, detail arsitektur + impact | TODO |
| Source Code | GitHub repo, documented | TODO |
| Live Demo | Web-based, bisa dicoba juri | TODO |

---

## 10. Implementation Phases

### Phase 1: Foundation (Hari 1-3)
- Setup project (React + FastAPI + MongoDB + Docker Compose)
- MongoDB schema + seed synthetic data (50 produk, 10 persona)
- Basic FastAPI endpoints: CRUD produk, customers
- Basic React shell: Chat widget + Owner dashboard layout

### Phase 2: AI Pipeline Core (Hari 4-8)
- Stage 1-2: Intake + Understanding (NLU intent + entity extraction)
- Stage 3: RAG setup (MongoDB Atlas Vector Search + BM25 hybrid)
- Stage 4: Tool implementations (cek_stok, buat_draft_pesanan, hitung_harga)
- Integration dengan Hermes Agent framework
- End-to-end test: Pesan masuk → tool call → respons keluar

### Phase 3: HITL + Real-time (Hari 9-12)
- Stage 5: Approval system (WebSocket notif, approve/reject UI)
- Timeout handling (15/30/60 menit cascade)
- Socket.io integration untuk live updates
- Owner dashboard: Approval queue, conversation monitor

### Phase 4: Analytics + Observability (Hari 13-16)
- Stage 7: Analytics event logging
- Dashboard charts (Recharts): Intent distribution, response time, approval rate
- Workflow trace viewer (Kanban-style stage visualization)
- Daily summary generation

### Phase 5: Polish + Demo Prep (Hari 17-20)
- UI/UX polish: Responsive, loading states, error states
- Automated demo script (synthetic customers auto-messaging)
- Edge case testing: Timeout flow, duplikat message, stok habis
- Demo video recording
- Artikel penulisan (800+ kata)
- Final deployment + testing

---

## 11. Risk Register

| Risk | Impact | Mitigasi |
|---|---|---|
| Owner offline saat approval | Pesanan tertunda, pelanggan kecewa | Graduated timeout (15/30/60min) + auto-hold + customer notification |
| Duplikat pesan pelanggan | Double order, stok kacau | Idempotency key: hash(customer_id + message + 5min_window) |
| RAG data outdated vs DB real-time | Jawab "stok ada" padahal habis | DB always wins untuk stok/harga, RAG hanya untuk deskripsi/info |
| AI hallucination | Jawaban salah tentang produk | Citation guardrails + confidence threshold + fallback template |
| API model AI down saat demo | Demo gagal | Cascade model strategy: Primary → Fallback 1 → Fallback 2 → Template statis |
| Demo video melebihi 5 menit | Didiskualifikasi | Script ketat + rehearsal minimal 3x |
| Rate limit tercapai | Respons lambat | Redis-based rate limiter + queue overflow handling |

---

## 12. Keputusan Arsitektur (ADR)

### ADR-1: Web Inbox vs WhatsApp Live
**Keputusan**: Web Inbox Simulator
**Alasan**: Kontrol penuh saat demo, tidak bergantung pada Twilio/WhatsApp API availability. Juri bisa mencoba langsung tanpa setup WhatsApp. Arsitektur tetap channel-agnostic — WhatsApp bisa ditambah post-hackathon tanpa refactor.

### ADR-2: Hermes vs OpenClaw
**Keputusan**: Hermes Agent
**Alasan**: Multi-agent Kanban DAG topology lebih cocok untuk 7-stage pipeline. Built-in persistent memory. Lebih mature untuk business workflow orchestration vs OpenClaw yang fokus personal agent.

### ADR-3: MongoDB Atlas Vector Search vs Separate Vector DB
**Keputusan**: MongoDB Atlas Vector Search
**Alasan**: Unified stack — tidak perlu maintain Pinecone/Qdrant terpisah. Mengurangi deployment complexity. Cukup performant untuk katalog < 10K SKU (scope UMKM).

### ADR-4: No Auto-Approve
**Keputusan**: Semua state-changing actions butuh human approval
**Alasan**: Trust & safety untuk UMKM. Satu kesalahan order bisa berdampak signifikan untuk usaha kecil. Kecepatan bukan prioritas utama — akurasi dan kontrol lebih penting.

---

## 13. Future Improvements (Post-Hackathon)

- WhatsApp Business API integration (Twilio/Fontte)
- Multi-channel support (Tokopedia chat, Shopee chat, Instagram DM)
- Auto-approve rules engine (trusted customers, low-value orders)
- Pembayaran terintegrasi (QRIS via Stripe/Xendit)
- Multi-toko support (satu agent, banyak UMKM)
- Voice message processing (speech-to-text → pipeline)
- Advanced analytics: Customer segmentation, churn prediction

---

## 14. Open Questions

- **Model AI default kompetisi**: Apakah IDwebhost menyediakan API model tertentu yang wajib digunakan? Perlu dicek saat technical meeting 1 September.
- **Hosting untuk live demo**: Apakah perlu self-hosted atau bisa pakai cloud (Railway, Render, dll)?
- **Bahasa artikel**: Bahasa Indonesia atau English? (Rekomendasi: Bahasa Indonesia karena konteks kompetisi lokal)