"""Seed data: 50 products (6 identik src/data.js + 44 generated) + 10 personas.

Idempoten: dipanggil via POST /api/seed → upsert by sku (products) & persona_id (personas).
"""
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---- 6 produk existing (identik src/data.js: prod) ----
_EXISTING = [
    ("KRP-01", "Keripik Pisang Balado", "Snack", 29000, 148, 200,
     "Keripik pisang renyah dengan bumbu balado khas, cocok untuk teman ngemil.",
     ["original", "balado", "manis"]),
    ("SRO-02", "Sambal Roa Pedas", "Sambal", 65000, 24, 150,
     "Sambal roa asli Manado, pedas mantap dengan ikan roa asap pilihan.",
     ["pedas", "extra pedas"]),
    ("KCT-03", "Kacang Telur Gurih", "Snack", 27000, 96, 180,
     "Kacang tanah balut tepung telur gurih renyah, dikemas 250gr.",
     ["original", "pedas manis"]),
    ("RNG-04", "Rengginang Original", "Snack", 29000, 11, 160,
     "Rengginang ketan asli, digoreng renyah, tanpa pengawet.",
     ["original", "terasi"]),
    ("KTP-05", "Keripik Tempe Original", "Snack", 27000, 212, 250,
     "Keripik tempe tipis renyah, cita rasa tradisional Malang.",
     ["original", "balado", "pedas manis"]),
    ("PKO-06", "Paket Oleh-oleh Mix", "Bundling", 155000, 8, 60,
     "Paket bundling isi 5 snack pilihan, cocok untuk oleh-oleh keluarga.",
     ["mix isi 5"]),
]

# ---- 44 produk tambahan (Fashion / F&B / Kerajinan) ----
_EXTRA = [
    # Fashion (15)
    ("KAO-07", "Kaos Batik Modern", "Fashion", 89000, 75, 120,
     "Kaos katun combed 30s motif batik modern, adem dipakai harian.",
     ["S", "M", "L", "XL"]),
    ("KMJ-08", "Kemeja Tenun Sumba", "Fashion", 235000, 32, 80,
     "Kemeja pria tenun asli Sumba, cocok kondangan hingga kerja.",
     ["M", "L", "XL"]),
    ("BRK-09", "Blus Kerja Wanita", "Fashion", 145000, 58, 120,
     "Blus formal bahan crepe premium, tidak kusut, elegan.",
     ["S", "M", "L"]),
    ("HJB-10", "Hijab Voal Premium", "Fashion", 65000, 210, 300,
     "Hijab segi empat voal 115x115, jatuh & tidak mudah kusut.",
     ["mocca", "sage", "dusty", "hitam"]),
    ("CLN-11", "Celana Kulot Linen", "Fashion", 129000, 44, 100,
     "Celana kulot bahan linen adem, karet belakang nyaman all-day.",
     ["S", "M", "L", "XL"]),
    ("SPT-12", "Sepatu Kulit Handmade", "Fashion", 385000, 18, 40,
     "Sepatu kulit asli jahit tangan pengrajin Cibaduyut, awet.",
     ["39", "40", "41", "42", "43"]),
    ("TAS-13", "Tas Rajut Handmade", "Fashion", 175000, 22, 60,
     "Tas rajut tangan model bucket, tali kulit premium.",
     ["cream", "navy", "terracotta"]),
    ("DMP-14", "Dompet Kulit Sapi", "Fashion", 155000, 40, 80,
     "Dompet lipat kulit sapi asli, slot kartu 8, muat uang & KTP.",
     ["cokelat", "hitam"]),
    ("JKT-15", "Jaket Denim Vintage", "Fashion", 265000, 28, 60,
     "Jaket denim cutting vintage, washed effect, bahan tebal.",
     ["S", "M", "L", "XL"]),
    ("DRS-16", "Dress Batik Cap", "Fashion", 195000, 36, 80,
     "Dress midi bahan katun batik cap Pekalongan, adem elegan.",
     ["S", "M", "L"]),
    ("KRS-17", "Kerudung Instan Anak", "Fashion", 45000, 88, 150,
     "Kerudung instan bahan jersey, nyaman untuk anak sekolah.",
     ["putih", "pink", "abu"]),
    ("SND-18", "Sandal Tenun Tali", "Fashion", 95000, 55, 100,
     "Sandal tali tenun etnik, sol karet anti-slip.",
     ["S", "M", "L"]),
    ("MKN-19", "Masker Kain Batik", "Fashion", 25000, 320, 500,
     "Masker kain 3 lapis motif batik, ada filter pocket.",
     ["1 pcs", "3 pcs", "5 pcs"]),
    ("STG-20", "Sarung Tenun Bali", "Fashion", 145000, 42, 80,
     "Sarung tenun songket Bali, cocok sembahyang & upacara.",
     ["merah", "hijau", "cokelat"]),
    ("SYL-21", "Selendang Tenun Ikat", "Fashion", 185000, 26, 60,
     "Selendang tenun ikat NTT, motif tradisional pilihan.",
     ["motif A", "motif B", "motif C"]),

    # F&B (15)
    ("KPS-22", "Kopi Robusta Lampung 250g", "F&B", 55000, 120, 200,
     "Kopi bubuk Robusta Lampung, medium roast, aroma cokelat.",
     ["bubuk", "biji"]),
    ("KPA-23", "Kopi Arabika Gayo 250g", "F&B", 75000, 88, 150,
     "Kopi Arabika Gayo single origin, light-medium roast, asam segar.",
     ["bubuk", "biji"]),
    ("TEH-24", "Teh Melati Premium 100g", "F&B", 35000, 145, 250,
     "Teh melati wangi premium, daun teh pilihan.",
     ["celup", "seduh"]),
    ("MDU-25", "Madu Hutan Murni 500ml", "F&B", 125000, 62, 120,
     "Madu hutan Sumbawa murni, tidak dicampur, panen langsung.",
     ["500ml", "1L"]),
    ("KRT-26", "Keripik Singkong Balado", "F&B", 22000, 180, 300,
     "Keripik singkong tipis pedas balado, renyah tahan lama.",
     ["original", "balado", "keju"]),
    ("KRJ-27", "Kerupuk Udang Sidoarjo", "F&B", 42000, 95, 200,
     "Kerupuk udang asli Sidoarjo, gurih mengembang saat digoreng.",
     ["250g", "500g"]),
    ("DDG-28", "Dodol Garut Original", "F&B", 38000, 72, 150,
     "Dodol Garut kemasan mini isi 20 pcs, oleh-oleh legendaris.",
     ["original", "wijen", "cokelat"]),
    ("BKP-29", "Bakpia Kukus Jogja", "F&B", 45000, 68, 120,
     "Bakpia kukus kacang hijau khas Jogja, kemasan 20 pcs.",
     ["kacang hijau", "cokelat", "keju"]),
    ("PMP-30", "Pempek Palembang Frozen", "F&B", 85000, 42, 100,
     "Pempek Palembang isi 10 pcs + cuko botol, frozen tahan 1 bulan.",
     ["kapal selam", "lenjer", "mix"]),
    ("SBH-31", "Sambal Bawang Homemade", "F&B", 32000, 110, 200,
     "Sambal bawang homemade tanpa pengawet, pedas segar.",
     ["pedas", "extra pedas"]),
    ("SEB-32", "Serundeng Ebi Kering", "F&B", 48000, 84, 150,
     "Serundeng ebi kering, cocok topping nasi & bubur.",
     ["100g", "250g"]),
    ("ABG-33", "Abon Sapi Premium 200g", "F&B", 88000, 56, 120,
     "Abon sapi asli daging pilihan, gurih tidak alot.",
     ["original", "pedas"]),
    ("MNK-34", "Manisan Kolang-Kaling", "F&B", 28000, 92, 180,
     "Manisan kolang-kaling gula aren, kemasan cup 250gr.",
     ["gula aren", "sirup"]),
    ("KJT-35", "Kacang Sembunyi Tradisional", "F&B", 25000, 130, 220,
     "Kacang sembunyi balut tepung gula renyah, snack jadul.",
     ["original"]),
    ("MRN-36", "Marning Jagung Manis", "F&B", 24000, 165, 280,
     "Marning jagung manis renyah, gurih tanpa MSG.",
     ["original", "pedas"]),

    # Kerajinan (14)
    ("KRJ-37", "Anyaman Rotan Serbaguna", "Kerajinan", 145000, 24, 60,
     "Keranjang rotan anyaman tangan, cocok dekorasi & penyimpanan.",
     ["S", "M", "L"]),
    ("KYU-38", "Ukiran Kayu Jati Mini", "Kerajinan", 225000, 15, 40,
     "Patung ukiran kayu jati Jepara, hiasan meja premium.",
     ["burung", "kuda", "ikan"]),
    ("BTK-39", "Batik Tulis Lasem", "Kerajinan", 385000, 12, 30,
     "Kain batik tulis Lasem 2m, motif klasik pesisiran.",
     ["merah", "biru", "hijau"]),
    ("KRM-40", "Keramik Handmade Kasongan", "Kerajinan", 95000, 38, 80,
     "Vas keramik handmade Kasongan Jogja, finishing glossy.",
     ["S", "M", "L"]),
    ("LMP-41", "Lampu Hias Rotan", "Kerajinan", 265000, 18, 40,
     "Lampu hias rotan anyaman, cahaya hangat estetik.",
     ["gantung", "meja"]),
    ("WYG-42", "Wayang Kulit Mini", "Kerajinan", 175000, 22, 50,
     "Wayang kulit mini hiasan dinding, karya pengrajin Solo.",
     ["arjuna", "bima", "srikandi"]),
    ("KIP-43", "Kipas Bambu Lukis", "Kerajinan", 65000, 78, 150,
     "Kipas bambu lukis tangan motif tradisional.",
     ["batik", "bunga", "wayang"]),
    ("TPT-44", "Topeng Kayu Bali", "Kerajinan", 195000, 20, 50,
     "Topeng kayu ukir Bali, motif Barong & Rangda.",
     ["barong", "rangda", "sanghyang"]),
    ("GNG-45", "Gantungan Kunci Etnik", "Kerajinan", 18000, 240, 400,
     "Gantungan kunci etnik bahan kayu & tenun, souvenir hemat.",
     ["wayang", "batik", "tenun"]),
    ("PTG-46", "Patung Miniatur Tembaga", "Kerajinan", 285000, 14, 30,
     "Patung miniatur tembaga tempa handmade Boyolali.",
     ["kudus", "gajah", "candi"]),
    ("TSK-47", "Tas Anyaman Pandan", "Kerajinan", 155000, 32, 70,
     "Tas anyaman daun pandan wangi, ringan & kuat.",
     ["S", "M", "L"]),
    ("BKI-48", "Bingkai Foto Ukir", "Kerajinan", 85000, 45, 100,
     "Bingkai foto kayu ukir motif Jepara ukuran 20x30.",
     ["natural", "cokelat gelap"]),
    ("PBK-49", "Piring Bambu Ukir", "Kerajinan", 55000, 66, 130,
     "Piring bambu ukir, cocok penyajian tradisional.",
     ["S", "M"]),
    ("HGN-50", "Hiasan Dinding Tenun", "Kerajinan", 145000, 28, 60,
     "Hiasan dinding tenun ikat NTT bingkai kayu.",
     ["motif A", "motif B"]),
]


def get_products_seed() -> list[dict]:
    """Return 50 product dicts ready for MongoDB insertion."""
    now = _now_iso()
    docs = []
    for row in _EXISTING + _EXTRA:
        sku, name, kategori, price, stock, cap, desc, variants = row
        docs.append({
            "sku": sku,
            "name": name,
            "description": desc,
            "price": price,
            "stock": stock,
            "cap": cap,
            "variants": variants,
            "category": kategori,
            "updated_at": now,
        })
    return docs


# ---- 10 persona pelanggan ----
_PERSONAS = [
    ("cust-001", "Wulan Sari",     "+62 812-3344-9087", "WhatsApp",  "reseller_snack",   "Reseller snack di Sleman, order rutin mingguan."),
    ("cust-002", "Andi Pratama",   "+62 813-8891-2210", "WhatsApp",  "penggemar_sambal", "Pecinta sambal roa, sering restock 3 box."),
    ("cust-003", "Dewi Lestari",   "@dewi.lestari",     "Instagram", "tanya_stok",       "Pelanggan IG, sering tanya stok sebelum order."),
    ("cust-004", "Toko Berkah",    "+62 856-7712-3390", "WhatsApp",  "grosir_reseller",  "Toko oleh-oleh, ambil harga reseller volume besar."),
    ("cust-005", "Rizky Hidayat",  "+62 819-9917-0747", "WhatsApp",  "sensitive_qc",     "Sering retur karena rewel packaging."),
    ("cust-006", "Sinta Maulida",  "+62 822-2044-0722", "WhatsApp",  "keluarga_muda",    "Ibu muda beli paket bundling."),
    ("cust-007", "Nabila Putri",   "+62 811-1188-0831", "WhatsApp",  "korporat",         "Beli untuk hampers kantor."),
    ("cust-008", "Hendra Wijaya",  "+62 812-4423-0804", "WhatsApp",  "penggemar_tempe",  "Rutin beli keripik tempe untuk warung."),
    ("cust-009", "Cika Ramadhani", "+62 811-2020-5566", "WhatsApp",  "first_timer",      "Pelanggan baru, banyak tanya varian."),
    ("cust-010", "Bu Marni",       "+62 822-4400-1122", "WhatsApp",  "senior_hati_hati", "Ibu senior, butuh pendampingan panjang."),
]


def get_personas_seed() -> list[dict]:
    now = _now_iso()
    return [
        {
            "persona_id": pid,
            "name": name,
            "phone": phone,
            "channel": ch,
            "segment": seg,
            "notes": notes,
            "created_at": now,
        }
        for (pid, name, phone, ch, seg, notes) in _PERSONAS
    ]
