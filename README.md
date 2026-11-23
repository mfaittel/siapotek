# Panduan Instalasi Lokal

## Prasyarat
- **Node.js** versi 20 atau lebih baru (disarankan v22)
- **npm**
- *Catatan: Database menggunakan SQLite (via Prisma), sehingga tidak perlu menginstal server database terpisah.*

---

## Langkah Instalasi (Pengguna Baru)

1. **Clone repositori** dan masuk ke direktori proyek:
   ```bash
   git clone <URL_REPOSITORI_ANDA>
   cd <NAMA_FOLDER_PROYEK>
   ```

2. **Konfigurasi Environment (`.env`)**
   Salin file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Buka file `.env`, lalu sesuaikan dua hal berikut:
   - Pastikan URL database mengarah ke SQLite lokal:
     ```env
     DATABASE_URL="file:./dev.db"
     ```
   - Generate kode acak untuk `SESSION_SECRET` lewat terminal:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
     ```
     Tempel (*paste*) hasil kode acak tersebut ke variabel `SESSION_SECRET=` di dalam `.env`.

3. **Instal Dependensi & Setup Database**
   ```bash
   npm install
   npm run db:setup
   ```

4. **Isi Data Contoh (Seeding)**
   Jalankan perintah berikut untuk mengisi database kosong dengan data awal dan akun bawaan:
   ```bash
   npm run db:seed
   ```

5. **Jalankan Aplikasi**
   ```bash
   npm run dev
   ```
   Buka aplikasi di browser melalui **`http://localhost:3000`**.

---

## Akun Contoh (Setelah `db:seed`)
- **Admin:** `alya@sehatsentosa.id`
- **Staf:** `dina@sehatsentosa.id`
- **Kata sandi (keduanya):** `apotek123`
