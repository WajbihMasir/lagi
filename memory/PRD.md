# PRD — TuntasUMKM Dashboard Mockup (Static)

## Problem Statement
Buatkan mockup statis dashboard TuntasUMKM (FE ONLY, tanpa backend) dengan HTML, CSS, JS saja. Sidebar dapat di-collapse/minimize, logo semewah mungkin, desain bebas, fokus ke core fungsi (tidak terlalu ramai). Setelah selesai commit ke https://github.com/WajbihMasir/lagi.git

## User Choices
- Modul: Ringkasan, Transaksi, Produk & Stok, Laporan (4 halaman inti)
- Tema: dark premium, aksen emas + hijau jade
- Data: dummy statis realistis

## Architecture
- Pure static: `/app/frontend/public/mockup/{index.html, styles.css, app.js}`
- Hash-based view switching (`#ringkasan`, `#transaksi`, `#produk`, `#laporan`)
- Chart line & bar dibuat manual dengan inline SVG (tanpa library)
- Sidebar collapse state disimpan di `localStorage`
- `/app/frontend/src/App.js` hanya redirect root → `/mockup/index.html`
- Tidak ada backend / DB / API yang digunakan

## Implemented (17 Jun 2026)
- Logo SVG mewah (hex jade + gradient emas + checkmark)
- Sidebar collapsible + kuota agent + user card
- Ringkasan: 4 KPI, chart omzet 7 hari, antrian approval
- Transaksi: 3 KPI, tabel transaksi + filter chips
- Produk & Stok: 3 KPI, tabel stok dengan bar indikator stok kritis
- Laporan: chart kategori, metrik performa agent vs target PRD, rekap mingguan
- data-testid pada semua elemen interaktif/penting
- Commit & push ke repo GitHub `WajbihMasir/lagi` (branch main)

## Backlog
- P1: halaman Chat/Inbox simulasi percakapan agent
- P1: modal detail approval (approve/reject)
- P2: mode light theme, responsive drawer sidebar untuk mobile
- P2: integrasi backend nyata (FastAPI + MongoDB)
