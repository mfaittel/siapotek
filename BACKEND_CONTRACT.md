# Kontrak Server Actions Backend SIAPOTEK

Dokumen ini menjelaskan fungsi backend yang dapat digunakan oleh halaman frontend berikutnya. Semua nominal adalah Rupiah dalam bilangan bulat, bukan `float` atau string berformat `Rp`.

## Autentikasi

- `wajibLogin()` menerima Admin atau Staf yang aktif.
- `wajibLogin(true)` hanya menerima Admin.
- Sesi bertahan maksimal 8 jam dan menggunakan cookie HttpOnly.
- Perubahan kata sandi, peran, atau status aktif membatalkan token sesi versi lama.

## Kasir (kontrak frontend yang sudah ada)

File: `app/(app)/kasir/actions.ts`

```ts
bayar({
  items: [{ obatId: number, jumlah: number }],
  diskon: number,
  metode: "Tunai" | "QRIS" | "Debit",
  tunai: number,
})
```

Respons sukses: `{ kode: string, kembalian: number }`.
Respons gagal: `{ error: string }`.

Backend mengabaikan harga dari browser, mengambil harga jual dari database, memvalidasi stok, mengeluarkan batch FEFO, menyimpan `dibayar`, `kembalian`, HPP per item, serta mutasi dalam satu transaksi. Penjualan akan terhubung ke shift pengguna jika ada shift aktif.

## Shift

File: `app/(app)/shift/actions.ts`

### Buka shift

```ts
bukaShift({ kasAwal: number, catatan?: string })
```

Respons sukses: `{ ok: true, id: number }`.
Respons gagal: `{ ok: false, error: string }`.

Satu pengguna hanya dapat memiliki satu shift aktif. Batasan ini juga dijaga oleh unique key di database.

### Tutup shift

```ts
tutupShift({ kasAkhir: number, catatan?: string })
```

Respons sukses: `{ ok: true, kasHarus: number, selisih: number }`.

Rumus kas yang diharapkan:

`Kas awal + penjualan tunai - pengeluaran - pembayaran supplier tunai`

Penjualan QRIS/Debit dan pembayaran supplier Transfer/QRIS tidak mengubah kas fisik.

### Shift aktif

```ts
ambilShiftAktifSaya()
```

Mengembalikan shift aktif milik pengguna yang sedang login, atau `null`.

## Pembelian

File: `app/(app)/pembelian/actions.ts`

### Membuat pembelian

```ts
buatPembelian({
  supplierId: number,
  nomorInvoice?: string,
  tanggal?: "YYYY-MM-DD",
  jatuhTempo?: "YYYY-MM-DD",
  catatan?: string,
  dibayarSekarang?: number,
  metodePembayaran?: "Tunai" | "Transfer" | "QRIS",
  items: [{
    obatId: number,
    kodeBatch: string,
    kedaluwarsa: "YYYY-MM-DD",
    jumlah: number,
    hargaBeli: number,
  }],
})
```

Respons sukses: `{ ok: true, id, kode, total, sisaTagihan }`.
Respons gagal: `{ ok: false, error }`.

Aksi ini membuat dokumen pembelian, item pembelian, menambah stok, memperbarui HPP batch, mencatat mutasi, serta menyimpan pembayaran awal (bila ada) secara atomik. Akses Admin.

### Membayar tagihan supplier

```ts
bayarTagihanSupplier({
  pembelianId: number,
  jumlah: number,
  metode: "Tunai" | "Transfer" | "QRIS",
  catatan?: string,
})
```

Respons sukses: `{ ok: true, sisaTagihan, status }`.
Respons gagal: `{ ok: false, error }`.

Pembayaran boleh parsial tetapi tidak boleh melebihi saldo tagihan. Pembayaran tunai membutuhkan shift aktif. Setiap pembayaran disimpan sebagai baris histori baru. Akses Admin.

### Daftar tagihan

```ts
daftarTagihanSupplier({ hanyaJatuhTempo?: boolean })
```

Admin only. Mengembalikan pembelian yang masih berstatus `Belum Lunas` atau `Parsial`, lengkap dengan supplier dan histori pembayaran.

## Pengeluaran

File: `app/(app)/pengeluaran/actions.ts`

```ts
catatPengeluaran({
  nama: string,
  kategori: string,
  jumlah: number,
  catatan?: string,
})
```

Respons sukses: `{ ok: true, id }`.
Respons gagal: `{ ok: false, error }`.

Pengeluaran harus dibuat saat shift aktif dan dikaitkan dengan shift tersebut. Catatan pengeluaran tidak dapat dihapus melalui action ini agar audit kas tetap terjaga.

```ts
daftarPengeluaran({ dari?: Date, sampai?: Date, shiftId?: number })
```

Mengembalikan maksimal 500 data terbaru.

## Supplier

File: `app/(app)/supplier/actions.ts`

- `daftarSupplier()` mengembalikan seluruh supplier.
- `detailSupplier(id)` mengembalikan data supplier, riwayat pembelian, item, dan pembayaran.

Field kontak supplier (`telepon`, `email`, `alamat`, `catatan`) tersedia di schema. Server Action data master mendukung field tersebut apabila form frontend mengirimkannya; form lama tetap kompatibel.

## Laporan keuangan

File: `lib/laporan.ts`

```ts
ambilLaporanKeuangan("harian" | "bulanan" | "tahunan", "YYYY-MM-DD")
```

Admin only. Mengembalikan penjualan, HPP, laba kotor, pengeluaran, pembayaran supplier, pembelian, shift, utang supplier, dan arus kas.

Jika masih ada item transaksi lama dengan `hargaPokok = null`, `hppLengkap` bernilai `false`, `labaKotor` dan `labaBersih` bernilai `null`. Backend tidak menganggap HPP yang tidak diketahui sebagai nol.

## Struktur data penting

- `Batch.hargaBeli`: harga beli unit pada persediaan batch saat ini.
- `ItemTransaksi.hargaPokok`: snapshot HPP per unit untuk penjualan historis.
- `Transaksi.dibayar` / `Transaksi.kembalian`: pembayaran aktual/kembalian.
- `Pembelian` / `PembelianItem`: invoice pembelian dan rincian barang.
- `PembayaranSupplier`: histori setiap pembayaran tagihan supplier.
- `Shift`: kas awal, kas diharapkan, kas akhir, dan selisih.
- `Pengeluaran`: pengeluaran yang selalu terikat shift.
- `Mutasi`: catatan permanen setiap perubahan stok.
