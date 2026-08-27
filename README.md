# 🛴 Kasir DB — Multi-Outlet Scooter & Stroller Rental POS System ⚡

[![Go Backend](https://img.shields.io/badge/Go%20Backend-1.22+-00ADD8.svg)](server-go/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](docker-compose.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Sistem **Point of Sale (POS) & Rental Tracking Multi-Outlet** berkinerja tinggi yang dirancang khusus untuk operasional penyewaan skuter listrik, stroller anak, mainan, dan peralatan rental lainnya. Sistem dibangun menggunakan **Golang (net/http + chi + pgx/v5)** di backend, **PostgreSQL 16** sebagai database utama dengan dukungan JSONB, **Server-Sent Events (SSE)** untuk sinkronisasi realtime multi-kasir, dan **React 19 + Vite** di frontend.

---

## 📑 Daftar Isi
1. [Arsitektur & Flow Project](#-arsitektur--flow-project)
2. [Mekanisme Autentikasi & Otorisasi](#-mekanisme-autentikasi--otorisasi)
3. [Format Headers & Standar Komunikasi](#-format-headers--standar-komunikasi)
4. [Dokumentasi Lengkap API Endpoints & Payload](#-dokumentasi-lengkap-api-endpoints--payload)
   - [1. Autentikasi & Profil](#1-autentikasi--profil)
   - [2. Manajemen Pengguna (Admin)](#2-manajemen-pengguna-admin)
   - [3. Sesi Rental Aktif (Active Sessions)](#3-sesi-rental-aktif-active-sessions)
   - [4. Penyelesaian & Partial Return (Claim)](#4-penyelesaian--partial-return-claim)
   - [5. Transaksi & Audit Log](#5-transaksi--audit-log)
   - [6. Manajemen Outlet (Multi-Tenant)](#6-manajemen-outlet-multi-tenant)
   - [7. Pengaturan Sistem (Settings)](#7-pengaturan-sistem-settings)
   - [8. Realtime Stream (SSE) & Health Check](#8-realtime-stream-sse--health-check)
   - [9. Legacy Compatibility Mode (GAS)](#9-legacy-compatibility-mode-gas)
5. [Logika Bisnis & Perhitungan Overtime (OT)](#-logika-bisnis--perhitungan-overtime-ot)
6. [Panduan Menjalankan Project](#-panduan-menjalankan-project)

---

## 🧭 Arsitektur & Flow Project

### 1. Diagram Alur Kerja (End-to-End Workflow)

```mermaid
flowchart TD
    A[Buka Sistem / Pilih Outlet] --> B[Login Kasir / Admin]
    B --> C{Autentikasi Valid?}
    C -- Tidak --> B
    C -- Ya --> D[Dashboard POS & SSE Realtime Stream Connected]
    
    D --> E[Buat Sesi Rental Baru]
    E --> F[Generate ID Sesi, Nomor Antrian & Cetak Struk Awal / QR Tracking]
    F --> G[Timer Berjalan Realtime di UI & Broadcast SSE]
    
    G --> H{Pelanggan Kembali}
    H -- Kembalikan Sebagian Item --> I[Partial Return / Claim Parsial]
    I --> J[Catat Transaksi Parsial, Sisa Item Tetap Berjalan di Timer]
    J --> G
    
    H -- Kembalikan Semua Item --> K[Full Return / Settle Transaksi]
    K --> L[Hitung Durasi, Grace Period & Overtime Otomatis]
    L --> M[Pilih Pembayaran: Cash / QRIS / Split]
    M --> N[Simpan ke Tabel Transaksi, Hapus dari Sesi Aktif, Broadcast SSE]
    N --> O[Cetak Struk Selesai & Tutup Sesi]
    
    N --> P[Rekap Shift & Laporan Harian]
    P --> Q[Rollover Otomatis Jam 06:00 Pagi]
```

### 2. Penjelasan Tahapan Flow

1. **Pemilihan Outlet & Autentikasi:**
   - Kasir memilih cabang/outlet yang aktif (`outlet_id`).
   - Kasir melakukan login dengan username & password shift. Token sesi (32-character random string) diterbitkan dengan masa berlaku 12 jam (sliding window).
2. **Pembuatan Sesi Rental (`ActiveSession`):**
   - Kasir memasukkan nama pelanggan, memilih item unit rental (skuter/stroller), dan metode pembayaran awal (`cash`/`qris`).
   - Server meng-assign `queueNo` harian otomatis, mencatat `startTime` (epoch ms), dan menyiarkan event `SESSION_ADDED` ke seluruh terminal kasir di outlet terkait melalui Server-Sent Events (SSE).
   - Pelanggan mendapatkan QR Code unik yang mengarah ke halaman public tracker (`#track/<sessionId>`).
3. **Pemantauan Timer Realtime:**
   - Status sesi dihitung otomatis:
     - **Normal:** Durasi pemakaian < waktu sewa dasar (misal 60 menit).
     - **Grace Period:** Toleransi keterlambatan 10 menit 59 detik.
     - **Overtime (OT):** Keterlambatan di atas toleransi grace period dihitung berjenjang (per 30 menit / per jam).
     - **Zombie Warning:** Peringatan sesi rental lebih dari 8 jam yang belum diselesaikan.
4. **Penyelesaian Rental & Partial Return (`Claim`):**
   - **Full Return:** Mengembalikan seluruh unit, menghitung penalti overtime (jika ada), merekam transaksi ke database, dan menghapus sesi aktif.
   - **Partial Return:** Jika pelanggan menyewa 3 unit dan mengembalikan 1 unit terlebih dahulu, kasir dapat melakukan klaim parsial. Sistem mencatat pembayaran unit yang kembali, sementara 2 unit lainnya tetap berada di sesi aktif dengan timer awal yang sama.
5. **Shift & Rollover Harian:**
   - Cutoff pergantian shift harian terjadi secara deterministik pada pukul **06:00 pagi**.
   - Transaksi antara jam 00:00–05:59 akan tetap masuk ke tanggal operasional shift malam hari sebelumnya.

---

## 🔐 Mekanisme Autentikasi & Otorisasi

Sistem menggunakan **Token-Based Authentication** yang tersimpan di database (`auth_tokens`) dan diverifikasi oleh middleware Go (`RequireAuth` & `RequireAdmin`).

### 1. Metode Pengiriman Token (Resolusi Otomatis)
Backend akan memeriksa token autentikasi secara berurutan:
1. **HTTP Authorization Header (Disarankan):**
   ```http
   Authorization: Bearer <auth_token>
   ```
2. **HttpOnly Cookie:**
   ```http
   Cookie: auth_token=<auth_token>
   ```
3. **Query Parameter:**
   ```http
   GET /api/stream?outlet_id=outlet-1&token=<auth_token>
   ```

### 2. Masa Berlaku Token (TTL) & Sliding Expiration
- **Token Login Kasir/Admin:** `12 jam` (`43.200.000 ms`). Setiap request valid akan memperbarui masa aktif token secara otomatis (Sliding Expiration).
- **Token Eskalasi Admin (`VerifyAdmin`):** `10 menit` (`600.000 ms`) untuk otorisasi tindakan sensitif (seperti hapus transaksi, ubah setting).
- **Hashing Password:** Menggunakan algoritma **bcrypt**.

### 3. Tingkatan Hak Akses (Role)
| Role | Deskripsi Hak Akses |
|---|---|
| `cashier` | Menambah/mengedit sesi, melakukan claim, melihat transaksi hari ini, melihat log hapus. |
| `admin` | Seluruh hak akses kasir + CRUD Pengguna, CRUD Outlet, Menghapus Transaksi, Reset Data, Mengubah Pengaturan Global. |

---

## 📡 Format Headers & Standar Komunikasi

Semua request yang mengirim data ke server wajib menyertakan header:
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <auth_token>
X-Outlet-ID: <outlet_id>
```

> **Catatan Tenant Scoping:** Header `X-Outlet-ID` atau query parameter `?outlet_id=<id>` digunakan untuk membatasi ruang lingkup data pada outlet yang dipilih kasir.

---

## 📚 Dokumentasi Lengkap API Endpoints & Payload

---

### 1. Autentikasi & Profil

#### 🔹 `POST /api/login/cashier`
Digunakan untuk login kasir harian atau login kasir per cabang.

- **Akses:** Public (Rate Limited: 5 req / 5 min)
- **Request Payload Requirements:**
  - `username` *(string, required)*: Username kasir terdaftar.
  - `password` *(string, required)*: Password kasir atau Master Shift Password.
  - `outletId` *(string, optional)*: ID outlet target (default: `outlet-1`).

```json
// Request Body
{
  "username": "kasir_utama",
  "password": "shiftPassword123",
  "outletId": "outlet-1"
}
```

```json
// Response Body (200 OK - Sukses)
{
  "success": true,
  "user": {
    "username": "kasir_utama",
    "role": "cashier",
    "outletId": "outlet-1"
  },
  "token": "4f9d8b7a1c2e3f4a5b6c7d8e9f0a1b2c"
}

// Response Body (200 OK - Gagal)
{
  "success": false,
  "error": "Nama kasir tidak ditemukan atau password tidak sesuai!"
}
```

---

#### 🔹 `POST /api/login/admin`
Digunakan untuk login Administrator utama sistem.

- **Akses:** Public (Rate Limited)
- **Request Payload Requirements:**
  - `password` *(string, required)*: Password master admin.

```json
// Request Body
{
  "password": "adminSecretPassword"
}
```

```json
// Response Body (200 OK)
{
  "success": true,
  "user": {
    "username": "admin",
    "role": "admin"
  },
  "token": "e8a7c6b5d4e3f2a1b0c9d8e7f6a5b4c3"
}
```

---

#### 🔹 `POST /api/verify-admin`
Verifikasi password admin on-the-fly (misal: saat kasir ingin menghapus transaksi atau membuka menu terkunci) untuk menerbitkan token eskalasi 10 menit.

- **Akses:** Public / Authenticated
- **Request Payload:**
```json
{
  "password": "adminSecretPassword"
}
```

```json
// Response Body (200 OK)
{
  "valid": true,
  "token": "temp_admin_escalation_token_32chars"
}
```

---

#### 🔹 `POST /api/change-admin-pass`
Mengubah password master administrator.

- **Akses:** Admin Only (`Authorization: Bearer <admin_token>`)
- **Request Payload Requirements:**
  - `old_password` *(string, required)*
  - `new_password` *(string, required)*

```json
// Request Body
{
  "old_password": "admin123",
  "new_password": "newSecurePassword2026"
}
```

```json
// Response Body (200 OK)
{
  "success": true
}
```

---

### 2. Manajemen Pengguna (Admin)

#### 🔹 `GET /api/users`
Mengambil daftar user/kasir terdaftar.

- **Akses:** Admin Only
- **Query Params:** `?outlet_id=outlet-1` *(optional, filter per outlet)*
- **Response Body:**
```json
[
  {
    "id": 1,
    "username": "kasir_utama",
    "role": "cashier",
    "outletId": "outlet-1",
    "createdAt": "2026-08-26T10:00:00Z"
  }
]
```

---

#### 🔹 `POST /api/users`
Membuat atau memperbarui akun kasir / admin (Upsert). Password akan di-hash menggunakan bcrypt secara otomatis oleh server jika belum berupa hash.

- **Akses:** Admin Only
- **Request Payload Requirements:**
  - `username` *(string, required)*: Username unik.
  - `password` *(string, required)*: Password akun.
  - `role` *(string, required)*: `"cashier"` atau `"admin"`.
  - `outletId` *(string, optional)*: ID outlet yang ditugaskan.

```json
// Request Body
{
  "username": "kasir_sore",
  "password": "password123",
  "role": "cashier",
  "outletId": "outlet-1"
}
```

```json
// Response Body (200 OK)
{
  "success": true
}
```

---

#### 🔹 `DELETE /api/users/{username}`
Menghapus user kasir berdasarkan username.

- **Akses:** Admin Only
- **URL Param:** `username` *(string, required)*
- **Response Body (200 OK):**
```json
{
  "success": true
}
```

---

### 3. Sesi Rental Aktif (Active Sessions)

#### 🔹 `GET /api/sessions`
Mengambil seluruh sesi rental yang sedang berjalan untuk outlet tertentu.

- **Akses:** Kasir & Admin (`RequireAuth`)
- **Query Params:** `?outlet_id=outlet-1`
- **Response Body:**
```json
[
  {
    "id": "s-1724740000000",
    "outletId": "outlet-1",
    "queueNo": 1,
    "nama": "Budi Santoso",
    "items": [
      {
        "id": "scooter-1",
        "name": "Scooter Xiaomi Pro",
        "price": 35000,
        "durationMinutes": 60
      }
    ],
    "startTime": 1724740000000,
    "tanggal": "2026-08-27",
    "payAwal": "cash",
    "createdAt": "2026-08-27T08:00:00Z"
  }
]
```

---

#### 🔹 `POST /api/sessions`
Membuat sesi rental baru saat pelanggan mulai menyewa unit.

- **Akses:** Kasir & Admin
- **Request Payload Requirements:**
  - `id` *(string, required)*: Unique session ID (misal: `"s-" + Date.now()`).
  - `outletId` *(string, required)*: ID outlet sesi ini.
  - `nama` *(string, required)*: Nama pelanggan.
  - `items` *(array / json, required)*: Rincian unit yang disewa beserta harga dasar.
  - `startTime` *(int64, required)*: Waktu mulai rental (Epoch Unix Milliseconds).
  - `tanggal` *(string, required)*: Tanggal sesi (`YYYY-MM-DD`).
  - `payAwal` *(string, required)*: `"cash"` atau `"qris"`.

```json
// Request Body
{
  "id": "s-1724741234567",
  "outletId": "outlet-1",
  "nama": "Ahmad Dani",
  "items": [
    {
      "id": "scooter-red",
      "name": "Scooter Merah",
      "price": 30000
    },
    {
      "id": "stroller-blue",
      "name": "Stroller Bayi",
      "price": 20000
    }
  ],
  "startTime": 1724741234567,
  "tanggal": "2026-08-27",
  "payAwal": "cash"
}
```

```json
// Response Body (200 OK)
{
  "success": true,
  "session": {
    "id": "s-1724741234567",
    "outletId": "outlet-1",
    "queueNo": 2,
    "nama": "Ahmad Dani",
    "items": [
      {
        "id": "scooter-red",
        "name": "Scooter Merah",
        "price": 30000
      },
      {
        "id": "stroller-blue",
        "name": "Stroller Bayi",
        "price": 20000
      }
    ],
    "startTime": 1724741234567,
    "tanggal": "2026-08-27",
    "payAwal": "cash",
    "createdAt": "2026-08-27T08:20:34Z"
  }
}
```

---

#### 🔹 `PUT /api/sessions/{id}`
Memperbarui data sesi rental aktif (misal ganti nama pelanggan atau penambahan item).

- **Akses:** Kasir & Admin
- **URL Param:** `id` *(string, required)*
- **Request Payload:** Objek `ActiveSession` yang dimodifikasi.
- **Response Body:** `{"success": true, "session": { ... }}`

---

#### 🔹 `DELETE /api/sessions/{id}`
Membatalkan atau menghapus sesi aktif tanpa membukukannya sebagai transaksi selesai.

- **Akses:** Kasir & Admin
- **URL Param:** `id` *(string, required)*
- **Response Body:** `{"success": true}`

---

#### 🔹 `GET /api/track/{id}`
Endpoint publik yang diakses oleh pelanggan via scan QR receipt untuk memantau sisa durasi rental secara live.

- **Akses:** Public (Tanpa token)
- **URL Param:** `id` *(string, required - Session ID atau Transaction ID)*
- **Response Body:**
```json
{
  "session": {
    "id": "s-1724741234567",
    "outletId": "outlet-1",
    "queueNo": 2,
    "nama": "Ahmad Dani",
    "items": [...],
    "startTime": 1724741234567,
    "tanggal": "2026-08-27",
    "payAwal": "cash"
  }
}
```

---

### 4. Penyelesaian & Partial Return (Claim)

#### 🔹 `POST /api/claim` *(atau `POST /api/claim-session`)*
Endpoint terpadu untuk menyelesaikan rental, menghitung penalti overtime, dan mendukung **Partial Return**.

- **Akses:** Kasir & Admin (`RequireAuth`, Rate Limited)
- **Request Payload Requirements:**
  - `sessionId` *(string, optional)*: ID sesi aktif yang akan di-claim.
  - `outletId` *(string, required)*: ID outlet transaksi.
  - `queueNo` *(integer, required)*: Nomor antrian sesi.
  - `nama` *(string, required)*: Nama pelanggan.
  - `tanggal` *(string, required)*: Tanggal shift transaksi (`YYYY-MM-DD`).
  - `startTime` *(int64, required)*: Waktu mulai rental (Epoch ms).
  - `endTime` *(int64, required)*: Waktu selesai rental (Epoch ms).
  - `items` *(string, required)*: Deskripsi teks ringkasan unit yang diselesaikan.
  - `ot` *(string)*: Keterangan status overtime (misal: `"-"`, `"OT 30m"`, `"OT 1 Jam"`).
  - `otDur` *(string)*: Durasi overtime (misal: `"00:25:00"`).
  - `totalBase` *(float64)*: Total tarif dasar sewa unit yang dikembalikan.
  - `totalOT` *(float64)*: Total denda overtime.
  - `totalTol` *(float64)*: Potongan toleransi/diskon kasir.
  - `grandTotal` *(float64)*: Total tagihan (`totalBase + totalOT - totalTol`).
  - `totalAll` *(float64)*: Total keseluruhan uang yang disetor.
  - `payAwal` *(string)*: Pembayaran di muka (`"cash"` / `"qris"`).
  - `cash` *(float64)*: Jumlah dibayar tunai.
  - `qris` *(float64)*: Jumlah dibayar non-tunai QRIS.
  - `shift` *(string)*: Kode shift kasir (misal: `"pagi"`, `"malam"`).
  - `remainingItems` *(array / json, optional)*: **Field Kunci Partial Return.** Jika ada item yang belum dikembalikan, cantumkan sisa unit di sini. Server akan tetap mempertahankan sesi aktif untuk sisa item tersebut.

```json
// Contoh Payload: Partial Return (1 Skuter kembali, 1 Stroller masih berjalan)
{
  "sessionId": "s-1724741234567",
  "outletId": "outlet-1",
  "queueNo": 2,
  "nama": "Ahmad Dani",
  "tanggal": "2026-08-27",
  "startTime": 1724741234567,
  "endTime": 1724744834567,
  "items": "Scooter Merah (1 Unit)",
  "ot": "-",
  "otDur": "-",
  "totalBase": 30000,
  "totalOT": 0,
  "totalTol": 0,
  "grandTotal": 30000,
  "totalAll": 30000,
  "payAwal": "cash",
  "cash": 30000,
  "qris": 0,
  "shift": "pagi",
  "remainingItems": [
    {
      "id": "stroller-blue",
      "name": "Stroller Bayi",
      "price": 20000
    }
  ]
}
```

```json
// Response Body (200 OK)
{
  "success": true,
  "transaction": {
    "id": "t-1724744834567",
    "outletId": "outlet-1",
    "no": 105,
    "queueNo": 2,
    "nama": "Ahmad Dani",
    "tanggal": "2026-08-27",
    "startTime": 1724741234567,
    "endTime": 1724744834567,
    "items": "Scooter Merah (1 Unit)",
    "ot": "-",
    "otDur": "-",
    "totalBase": 30000,
    "totalOT": 0,
    "totalTol": 0,
    "grandTotal": 30000,
    "totalAll": 30000,
    "payAwal": "cash",
    "cash": 30000,
    "qris": 0,
    "shift": "pagi",
    "createdAt": "2026-08-27T09:20:34Z"
  }
}
```

---

### 5. Transaksi & Audit Log

#### 🔹 `GET /api/transactions`
Mengambil data riwayat transaksi selesai.

- **Akses:** Kasir & Admin (`RequireAuth`)
- **Query Params:**
  - `outlet_id` *(string, optional)*: Filter outlet (contoh: `outlet-1`).
  - `tanggal` *(string, optional)*: Filter tanggal shift (`YYYY-MM-DD`).
- **Response Body:**
```json
[
  {
    "id": "t-1724744834567",
    "outletId": "outlet-1",
    "no": 105,
    "queueNo": 2,
    "nama": "Ahmad Dani",
    "tanggal": "2026-08-27",
    "startTime": 1724741234567,
    "endTime": 1724744834567,
    "items": "Scooter Merah (1 Unit)",
    "ot": "OT 30m",
    "otDur": "00:20:00",
    "totalBase": 30000,
    "totalOT": 15000,
    "totalTol": 0,
    "grandTotal": 45000,
    "totalAll": 45000,
    "payAwal": "cash",
    "cash": 45000,
    "qris": 0,
    "shift": "pagi",
    "createdAt": "2026-08-27T09:20:34Z"
  }
]
```

---

#### 🔹 `DELETE /api/transactions/{id}`
Menghapus transaksi tertentu.

- **Akses:** Admin Only (`RequireAdmin`)
- **URL Param:** `id` *(string, required)*
- **Response Body:** `{"success": true}`

---

#### 🔹 `POST /api/transactions/clear-all`
Menghapus seluruh transaksi pada outlet tertentu (biasanya untuk reset shift / testing).

- **Akses:** Admin Only
- **Request Payload:**
```json
{
  "outletId": "outlet-1"
}
```
- **Response Body:** `{"success": true}`

---

#### 🔹 `GET /api/deletion-logs`
Melihat catatan audit log transaksi yang pernah dihapus oleh admin.

- **Akses:** Kasir & Admin
- **Query Params:** `?outlet_id=outlet-1&limit=100`
- **Response Body:**
```json
{
  "logs": [
    {
      "id": 1,
      "outletId": "outlet-1",
      "txnId": "t-1724744834567",
      "txnNo": 105,
      "txnNama": "Ahmad Dani",
      "txnTanggal": "2026-08-27",
      "txnTotalAll": 45000,
      "deletedAt": 1724745000000,
      "deletedBy": "admin"
    }
  ]
}
```

---

### 6. Manajemen Outlet (Multi-Tenant)

#### 🔹 `GET /api/outlets`
Mengambil daftar semua outlet yang tersedia di sistem.

- **Akses:** Public / Authenticated
- **Response Body:**
```json
[
  {
    "id": "outlet-1",
    "nama": "Outlet Pusat",
    "alamat": "Jl. Utama No. 1",
    "createdAt": "2026-08-01T00:00:00Z"
  },
  {
    "id": "outlet-2",
    "nama": "Outlet Cabang 2",
    "alamat": "Jl. Cabang No. 2",
    "createdAt": "2026-08-15T00:00:00Z"
  }
]
```

---

#### 🔹 `POST /api/outlets`
Menambah atau memperbarui cabang outlet baru.

- **Akses:** Admin Only
- **Request Payload Requirements:**
  - `id` *(string, required)*: Kode ID unik outlet (misal: `"outlet-mall-3"`).
  - `nama` *(string, required)*: Nama cabang outlet.
  - `alamat` *(string, optional)*: Alamat cabang.

```json
{
  "id": "outlet-mall-3",
  "nama": "Outlet Mall Grand City",
  "alamat": "Lantai 2 Funzone"
}
```

```json
// Response Body (200 OK)
{
  "success": true,
  "outlet": {
    "id": "outlet-mall-3",
    "nama": "Outlet Mall Grand City",
    "alamat": "Lantai 2 Funzone"
  }
}
```

---

#### 🔹 `DELETE /api/outlets/{id}`
Menghapus outlet dari sistem.

- **Akses:** Admin Only
- **URL Param:** `id` *(string, required)*
- **Response Body:** `{"success": true}`

---

### 7. Pengaturan Sistem (Settings)

#### 🔹 `GET /api/settings`
Mengambil kamus konfigurasi sistem (scoped by outlet atau global).

- **Akses:** Kasir & Admin
- **Query Params:** `?outlet_id=outlet-1`
- **Response Body:**
```json
{
  "app_name": "Kasir Rental Scooter & Stroller",
  "ot_rate_half": "15000",
  "ot_rate_full": "30000",
  "grace_period_sec": "659",
  "print_header": "KASIR RENTAL JAYA",
  "print_footer": "Terima kasih atas kunjungan Anda"
}
```

---

#### 🔹 `POST /api/settings`
Menyimpan konfigurasi outlet atau global.

- **Akses:** Admin Only
- **Request Payload Requirements:**
  - `key` *(string, required)*: Kunci konfigurasi.
  - `value` *(string, required)*: Nilai konfigurasi.
  - `outletId` *(string, optional)*: Target outlet (default: `"global"`).

```json
{
  "key": "ot_rate_half",
  "value": "20000",
  "outletId": "outlet-1"
}
```

```json
// Response Body (200 OK)
{
  "success": true
}
```

---

### 8. Realtime Stream (SSE) & Health Check

#### 🔹 `GET /api/stream`
Membuka koneksi HTTP Server-Sent Events (SSE) berkecepatan tinggi untuk menerima pembaruan instan tanpa polling.

- **Akses:** Public / Authenticated
- **Query Params:**
  - `outlet_id` *(string, required)*: ID outlet yang dipantau (atau `"all"` untuk admin).
  - `token` *(string, optional)*: Auth token.
- **Event Types yang Dikirimkan:**
  - `INIT`: Payload daftar sesi saat pertama kali terhubung.
  - `SESSION_ADDED`: Disiarkan saat ada sesi rental baru.
  - `SESSION_UPDATED`: Disiarkan saat sesi diperbarui atau setelah partial claim.
  - `SESSION_DELETED`: Disiarkan saat sesi dibatalkan atau selesai di-claim.
  - `SESSION_CLAIMED`: Disiarkan saat sesi berhasil diselesaikan.
  - `TXN_DELETED`: Disiarkan saat transaksi dihapus.
  - `TXNS_CLEARED`: Disiarkan saat seluruh transaksi direset.
  - `OUTLET_UPDATED`: Disiarkan saat outlet ditambah/diedit.
  - `SETTING_UPDATED`: Disiarkan saat setting diperbarui.
  - `HEARTBEAT`: Disiarkan berkala setiap 15 detik untuk menjaga koneksi aktif.

```http
// Contoh Data Stream SSE
event: SESSION_ADDED
data: {"type":"SESSION_ADDED","outletId":"outlet-1","payload":{"id":"s-1001","nama":"Budi",...}}
```

---

#### 🔹 `GET /health` & `GET /ready`
Probes untuk container orchestration (Docker/Kubernetes).

- `GET /health`: Liveness probe (memastikan service web running).
- `GET /ready`: Readiness probe (memastikan koneksi database PostgreSQL aktif).

---

### 9. Legacy Compatibility Mode (GAS)

Bagi klien frontend yang menggunakan format Action-Payload RPC (seperti Google Apps Script WebApp), backend Go menyediakan endpoint polimorfik:

#### 🔹 `POST /api/` *(atau `POST /`)*
- **Header:** `Authorization: Bearer <token>`
- **Request Body Format:**
```json
{
  "action": "add_session",
  "payload": {
    "id": "s-1724741234567",
    "outletId": "outlet-1",
    "nama": "Ahmad Dani",
    "items": [...],
    "startTime": 1724741234567,
    "tanggal": "2026-08-27",
    "payAwal": "cash"
  },
  "token": "optional_bearer_token"
}
```

- **Daftar Action yang Didukung:**
  `fetch_data`, `add_session`, `edit_session`, `delete_session`, `claim_session`, `save_setting`, `save_user`, `delete_user`, `delete_txn`, `clear_all_txns`, `verify_admin`, `change_admin_pass`, `login_cashier`, `login_admin`, `track_session`, `get_deletion_logs`, `add_deletion_log`, `get_outlets`, `create_outlet`, `delete_outlet`, `backup_db`.

---

## ⏱️ Logika Bisnis & Perhitungan Overtime (OT)

Sistem menghitung overtime secara otomatis berdasarkan interval waktu:

1. **Durasi Standar:** Dihitung dari `startTime` hingga `endTime`.
2. **Grace Period (Toleransi Keterlambatan):**
   - Toleransi default: `10 menit 59 detik` (`659 detik`).
   - Jika durasi lebih dari sewa dasar namun masih dalam batas `659 detik`, maka status OT = `"-"` dan denda = `Rp 0`.
3. **Perhitungan Jenjang Denda (Tiered OT):**
   - **Keterlambatan 11 s/d 40 Menit:** Dikenakan tarif **Half-Hour OT** (Default: 50% dari tarif sewa per jam).
   - **Keterlambatan 41 s/d 60 Menit:** Dikenakan tarif **Full-Hour OT** (Default: 100% dari tarif sewa per jam).
   - **Keterlambatan > 1 Jam:** Menghitung kelipatan jam penuh + sisa menit secara proporsional.
4. **Rollover Shift Jam 06:00:**
   - Transaksi yang diselesaikan antara pukul 00:00 hingga 05:59 WIB secara otomatis dikelompokkan ke tanggal kalender hari sebelumnya agar laporan omset shift malam tidak terbelah dua hari.

---

## 🚀 Panduan Menjalankan Project

### 1. Menjalankan dengan Docker Compose (Direkomendasikan)
Menjalankan PostgreSQL 16, Golang Backend, dan React Frontend dalam satu perintah:

```bash
# Clone repository
git clone https://github.com/sanixmon/kasir-foss.git
cd kasir-foss

# Jalankan seluruh stack
docker compose up --build -d
```

Akses layanan:
- 🌐 **Frontend POS (React):** `http://localhost:3000`
- ⚙️ **Backend API & SSE:** `http://localhost:8080`
- 🗄️ **PostgreSQL Database:** `localhost:5432` (`user: kasir`, `pass: kasir_password`, `db: kasir_db`)

---

### 2. Menjalankan Secara Standalone (Manual Dev)

#### A. Backend (Golang)
```bash
cd server-go
export DATABASE_URL="postgres://kasir:kasir_password@localhost:5432/kasir_db?sslmode=disable"
export PORT="8080"
export CORS_ORIGIN="*"
go run cmd/api/main.go
```

#### B. Frontend (React)
```bash
# Di root direktori repo:
pnpm install
pnpm dev
```
Buka browser di `http://localhost:5173`.

---

### 3. Menjalankan Test Suite
```bash
# Test Backend Golang (Unit, Repository, & Operational E2E Tests)
cd server-go
go test -v ./...

# Test Frontend Vitest (140 tests)
npm test
```

---

## 📄 Lisensi
Didistribusikan di bawah lisensi MIT. Lihat file [LICENSE](LICENSE) untuk detail lengkap.

