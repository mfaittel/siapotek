# SIAPOTEK — Paket Backend Terintegrasi

Paket ini mempertahankan frontend SIAPOTEK dari proyek sumber dan menggabungkan perubahan backend ke dalam satu codebase. Tidak ada redesign UI. Pola aplikasi tetap Next.js App Router, React, TypeScript, Server Actions, Prisma, dan SQLite.

## Fitur backend dalam paket

### Fitur yang sudah ada dan dipertahankan
- Login berbasis email/kata sandi dengan peran Admin dan Staf.
- Data master obat, supplier, dan pengguna.
- Stok masuk manual, penyesuaian stok, dan riwayat mutasi.
- Kasir dengan metode Tunai, QRIS, dan Debit.
- FEFO dan pemblokiran batch kedaluwarsa.
- Ringkasan dashboard, peringatan kedaluwarsa/stok minimum, dan laporan stok/mutasi/omset.
- Pengaturan apotek.

### Backend yang ditambahkan atau diperkuat
- Snapshot harga beli per batch (`Batch.hargaBeli`).
- Snapshot HPP per item penjualan (`ItemTransaksi.hargaPokok`).
- Pembayaran aktual dan kembalian (`Transaksi.dibayar`, `Transaksi.kembalian`).
- Relasi transaksi ke shift aktif bila tersedia.
- Modul Server Actions untuk membuka/menutup shift dan hitung kas.
- Modul pembelian dengan item batch, harga beli, stok masuk, utang supplier, serta pembayaran parsial.
- Modul pembayaran supplier dengan histori setiap pembayaran.
- Modul pengeluaran operasional yang terhubung dengan shift.
- Sumber data laporan keuangan yang menghitung HPP/laba hanya bila HPP transaksi lengkap.
- Validasi sesi lebih ketat dan token versi untuk membatalkan sesi lama setelah perubahan hak akses/kata sandi.
- Setup database dengan urutan schema → generate Prisma Client → backfill data lama.

## Persyaratan
- Node.js 20 atau lebih baru (proyek sumber dikembangkan dengan Node.js 22).
- npm.
- SQLite melalui Prisma; tidak perlu memasang server database terpisah.

## Instalasi pada komputer baru

1. Ekstrak ZIP ke folder proyek.
2. Salin `.env.example` menjadi `.env`.
3. Isi `SESSION_SECRET` dengan rahasia acak minimal 32 byte. Buat dengan:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

4. Pastikan `DATABASE_URL="file:./dev.db"`. Untuk Prisma, path relatif tersebut mengacu pada lokasi schema di folder `prisma/`, sehingga database berada di `prisma/dev.db`.
5. Jalankan:

   ```bash
   npm install
   npm run db:setup
   ```

6. Untuk database baru yang masih kosong dan ingin membuat data contoh:

   ```bash
   npm run db:seed
   ```

7. Jalankan aplikasi:

   ```bash
   npm run dev
   ```

   Buka `http://localhost:3000`.

## Pembaruan database proyek yang sudah berjalan

**Backup database sebelum melakukan pembaruan.** Pastikan nilai `DATABASE_URL` pada `.env` menunjuk ke file database yang benar. Jangan menyalin file database contoh dari ZIP ke atas database operasional.

Jalankan dari root proyek:

```bash
npm run db:setup
```

Perintah tersebut menjalankan berurutan:
1. `prisma db push` untuk menambahkan kolom dan tabel baru tanpa menghapus data lama.
2. `prisma generate` untuk membuat Prisma Client dari schema terbaru.
3. `prisma/backfill.js` untuk mengisi `Batch.hargaBeli` yang masih NULL menggunakan `Obat.hargaBeli` saat ini sebagai estimasi.

Ini juga memperbaiki masalah urutan pada patch sebelumnya: script backfill tidak boleh dijalankan sebelum schema database diperbarui. Tidak ada SQL backfill manual yang perlu dieksekusi terpisah.

Kemudian jalankan:

```bash
npm run typecheck
npm run build
npm run dev
```

Setelah pembaruan pertama ini, masuk kembali melalui halaman login. Token sesi dari versi sebelumnya tidak memiliki `tokenVersion` dan akan ditolak agar seluruh sesi memakai validasi baru.

Jika `prisma db push` menyatakan perubahan berpotensi menghapus data, **jangan lanjutkan dengan `--accept-data-loss`**. Hentikan dan periksa outputnya terlebih dahulu.

## Akun contoh

Hanya untuk database baru setelah `npm run db:seed`:

- Admin: `alya@sehatsentosa.id`
- Staf: `dina@sehatsentosa.id`
- Kata sandi awal keduanya: `apotek123`

Ganti kata sandi contoh sebelum aplikasi dipakai secara operasional. Menjalankan seed ulang tidak mengubah kata sandi, stok, atau harga data yang sudah ada.

## Catatan kompatibilitas dengan frontend sekarang

- Komponen dan desain frontend sumber dipertahankan.
- Input kasir tetap memakai kontrak `bayar({ items, diskon, metode, tunai })`.
- Penjualan otomatis dihubungkan ke shift aktif milik kasir jika ada.
- Karena frontend sumber belum memiliki layar buka/tutup shift, penjualan masih diizinkan tanpa shift secara default. Setelah layar shift sudah diintegrasikan dan diuji, tambahkan `SHIFT_WAJIB="true"` ke `.env` untuk mewajibkan shift sebelum kasir dapat bertransaksi.
- Modul pembelian, pembayaran supplier, pengeluaran, dan shift sudah tersedia sebagai Server Actions, tetapi belum ditambahkan ke navigasi/halaman karena tugas paket ini dibatasi pada backend. Frontend dapat mengimpor action dari folder masing-masing ketika halaman yang sesuai siap.
- Modul pembelian dan pembayaran supplier saat ini dibatasi untuk Admin. Pengeluaran dan pengelolaan shift dapat dilakukan Admin maupun Staf yang login.

## Aturan stok dan HPP

- FEFO menggunakan tanggal kedaluwarsa paling dekat terlebih dahulu.
- Batch dengan tanggal kedaluwarsa hari ini masih dapat dijual sampai akhir tanggal operasional Asia/Jakarta.
- Batch yang sudah kedaluwarsa tidak dapat digunakan untuk penjualan.
- Perubahan stok dan pencatatan mutasi dilakukan dalam satu transaksi database.
- Harga pokok penjualan disalin ke `ItemTransaksi.hargaPokok` saat transaksi terjadi, sehingga perubahan harga master di kemudian hari tidak mengubah HPP historis.
- Jika batch yang sama menerima stok dengan harga berbeda dan harga beli lama diketahui, harga batch dihitung dengan rata-rata tertimbang. Jika harga stok lama belum diketahui, backend tidak menebak HPP stok lama dan akan mempertahankan nilai NULL sampai stok lama habis.

## Perhatian tentang data historis

- Data lama pada `Batch.hargaBeli` diisi menggunakan harga beli master saat ini sebagai **estimasi awal**, bukan bukti harga pembelian lama yang sebenarnya.
- `ItemTransaksi.hargaPokok` transaksi lama dibiarkan NULL karena harga beli batch saat penjualan tidak tersedia pada sistem sebelumnya.
- `Transaksi.dibayar` dan `Transaksi.kembalian` transaksi lama tetap NULL karena nilai pembayaran aktual tidak pernah dicatat.
- Fungsi `ambilLaporanKeuangan()` menandai HPP tidak lengkap dan mengembalikan laba sebagai NULL bila masih ada item transaksi tanpa snapshot HPP; data historis tidak diperlakukan seolah-olah HPP-nya nol.

## Backup SQLite

Untuk backup, hentikan sementara proses penulisan (tutup aplikasi atau hentikan server), lalu salin file database yang benar-benar dirujuk oleh `DATABASE_URL`. Jangan mengasumsikan file database selalu berada di lokasi default bila `.env` sudah pernah diubah. Simpan backup pada media terpisah dan lakukan uji pemulihan secara berkala.

## Struktur action backend tambahan

- `app/(app)/shift/actions.ts`: `bukaShift`, `tutupShift`, `ambilShiftAktifSaya`.
- `app/(app)/pembelian/actions.ts`: `buatPembelian`, `bayarTagihanSupplier`, `daftarTagihanSupplier` (Admin only).
- `app/(app)/pengeluaran/actions.ts`: `catatPengeluaran`, `daftarPengeluaran`.
- `app/(app)/supplier/actions.ts`: `daftarSupplier`, `detailSupplier`.
- `lib/laporan.ts`: `ambilLaporanKeuangan`.

Lihat `BACKEND_CONTRACT.md` untuk bentuk input dan aturan penggunaan tiap action.
