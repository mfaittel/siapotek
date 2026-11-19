# Perbaikan navigasi tab SIAPOTEK

## Gejala
Tab seperti Stok Masuk, Penyesuaian Stok, Mutasi Stok, dan tab lain mengubah alamat URL tetapi konten tetap menampilkan tab sebelumnya.

## Perubahan
1. `components/Tab.tsx` sekarang menggunakan tautan HTML biasa (`<a href>`), sehingga browser membuat permintaan halaman baru dengan query `tab` yang dipilih. Ini menghindari tampilan server component yang tertinggal pada navigasi query di runtime sebelumnya.
2. Halaman yang membaca query tab (`stok`, `data-master`, `pengaturan`, `laporan`, `peringatan`) secara eksplisit menggunakan `dynamic = "force-dynamic"` agar konten dirender berdasarkan permintaan terbaru.
3. Nilai tab pada halaman Stok dan Peringatan dinormalisasi ke pilihan yang valid. Query yang tidak dikenal kembali ke tab default, bukan menyisakan konten kosong.

## Dampak
- Tidak ada perubahan schema database.
- Tidak ada perubahan Server Actions atau business logic.
- Tidak ada perubahan desain, kelas CSS, label, atau urutan tab.
- Semua tab yang memakai komponen `Tab` ikut mendapat perbaikan.

## File yang berubah
- `components/Tab.tsx`
- `app/(app)/stok/page.tsx`
- `app/(app)/data-master/page.tsx`
- `app/(app)/pengaturan/page.tsx`
- `app/(app)/laporan/page.tsx`
- `app/(app)/peringatan/page.tsx`

## Verifikasi lokal
Setelah mengganti file proyek, jalankan:

```bash
npm run dev
```

Lalu pastikan URL dan konten sama-sama berubah saat membuka setiap tab di Stok, Peringatan, Laporan, Data Master, dan Pengaturan. Uji juga tombol Back dan Forward browser.
