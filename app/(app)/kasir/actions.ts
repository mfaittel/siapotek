"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { awalHariJakartaUtc, rentangWaktuHariJakartaUtc } from "@/lib/tanggal";

type ItemInput = { obatId: number; jumlah: number };
type Input = { items: ItemInput[]; diskon: number; metode: string; tunai: number };
type Hasil = { error: string } | { kode: string; kembalian: number };

const METODE_PEMBAYARAN = ["Tunai", "QRIS", "Debit"] as const;

function validasiDanGabungkanItems(items: unknown): ItemInput[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) return null;
  const jumlahPerObat = new Map<number, number>();
  for (const item of items) {
    if (!item || typeof item !== "object") return null;
    const obatId = Number((item as ItemInput).obatId);
    const jumlah = Number((item as ItemInput).jumlah);
    if (!Number.isSafeInteger(obatId) || obatId <= 0 || !Number.isSafeInteger(jumlah) || jumlah <= 0) return null;
    const total = (jumlahPerObat.get(obatId) ?? 0) + jumlah;
    if (!Number.isSafeInteger(total)) return null;
    jumlahPerObat.set(obatId, total);
  }
  return Array.from(jumlahPerObat, ([obatId, jumlah]) => ({ obatId, jumlah }));
}

/**
 * Menyelesaikan penjualan dengan FEFO. Perubahan batch, transaksi, item,
 * dan mutasi stok terjadi dalam satu transaksi database.
 */
export async function bayar(input: Input): Promise<Hasil> {
  const sesi = await wajibLogin();
  if (!input || typeof input !== "object") return { error: "Data transaksi tidak valid." };

  const items = validasiDanGabungkanItems(input.items);
  if (!items) return { error: "Keranjang kosong atau berisi jumlah obat yang tidak valid." };
  if (!Number.isSafeInteger(input.diskon) || input.diskon < 0) return { error: "Diskon harus berupa angka bulat dan tidak boleh negatif." };
  if (!Number.isSafeInteger(input.tunai) || input.tunai < 0 || input.tunai > 2_147_483_647) return { error: "Jumlah pembayaran tidak valid." };
  if (!(METODE_PEMBAYARAN as readonly string[]).includes(input.metode)) return { error: "Metode pembayaran tidak dikenal." };

  try {
    const hasil = await db.$transaction(async (tx) => {
      const baris: { obatId: number; batchId: number; jumlah: number; harga: number; hargaPokok: number | null }[] = [];
      let subtotal = 0;
      const awalHari = awalHariJakartaUtc();

      for (const item of items) {
        const obat = await tx.obat.findUnique({ where: { id: item.obatId } });
        if (!obat || !Number.isSafeInteger(obat.hargaJual) || obat.hargaJual <= 0) {
          throw new Error("Data obat tidak valid atau harga jual belum benar.");
        }

        // Tanggal kedaluwarsa hari ini tetap layak jual sampai akhir hari WIB.
        const batch = await tx.batch.findMany({
          where: { obatId: obat.id, stok: { gt: 0 }, kedaluwarsa: { gte: awalHari } },
          orderBy: [{ kedaluwarsa: "asc" }, { id: "asc" }],
        });
        const tersedia = batch.reduce((total, current) => total + current.stok, 0);
        if (tersedia < item.jumlah) throw new Error(`Stok ${obat.nama} tidak cukup. Tersedia ${tersedia}.`);

        let sisa = item.jumlah;
        for (const b of batch) {
          if (sisa <= 0) break;
          const ambil = Math.min(b.stok, sisa);
          if (ambil <= 0) continue;

          // Predicate stok >= ambil mencegah stok negatif pada transaksi bersamaan.
          const perubahan = await tx.batch.updateMany({
            where: { id: b.id, stok: { gte: ambil } },
            data: { stok: { decrement: ambil } },
          });
          if (perubahan.count !== 1) {
            throw new Error(`Stok ${obat.nama} berubah saat transaksi. Muat ulang kasir lalu coba lagi.`);
          }

          baris.push({
            obatId: obat.id,
            batchId: b.id,
            jumlah: ambil,
            harga: obat.hargaJual,
            hargaPokok: b.hargaBeli,
          });
          sisa -= ambil;
        }
        if (sisa > 0) throw new Error(`Stok ${obat.nama} berubah saat transaksi. Muat ulang kasir lalu coba lagi.`);

        subtotal += obat.hargaJual * item.jumlah;
        if (!Number.isSafeInteger(subtotal) || subtotal > 2_147_483_647) {
          throw new Error("Total transaksi melebihi batas nominal yang didukung.");
        }
      }

      if (input.diskon > subtotal) throw new Error("Diskon tidak boleh melebihi subtotal transaksi.");
      const total = subtotal - input.diskon;
      if (input.metode === "Tunai" && input.tunai < total) throw new Error("Uang tunai kurang dari total transaksi.");
      const { awal, akhir, penandaTanggal } = rentangWaktuHariJakartaUtc();
      const yyyy = String(penandaTanggal.getUTCFullYear());
      const mm = String(penandaTanggal.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(penandaTanggal.getUTCDate()).padStart(2, "0");
      const kode = `TRX-${dd}${mm}${yyyy.slice(-2)}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const dibayar = input.metode === "Tunai" ? input.tunai : total;
      const kembalian = input.metode === "Tunai" ? input.tunai - total : 0;

      // Shift terhubung otomatis bila pengguna sudah membuka shift.
      // Tetap nullable agar frontend kasir lama tetap berjalan selama modul shift diintegrasikan.
      const shift = await tx.shift.findFirst({ where: { penggunaId: sesi.id, kunciAktif: String(sesi.id), tutupPada: null } });
      if (process.env.SHIFT_WAJIB === "true" && !shift) {
        throw new Error("Buka shift terlebih dahulu sebelum melayani transaksi.");
      }

      await tx.transaksi.create({
        data: {
          kode,
          kasirId: sesi.id,
          shiftId: shift?.id ?? null,
          diskon: input.diskon,
          total,
          metode: input.metode,
          dibayar,
          kembalian,
          item: { create: baris },
        },
      });

      for (const item of baris) {
        await tx.mutasi.create({
          data: { batchId: item.batchId, jenis: "Penjualan", jumlah: -item.jumlah, referensi: kode, petugasId: sesi.id },
        });
      }

      return { kode, kembalian };
    }, { maxWait: 10_000, timeout: 20_000 });

    revalidatePath("/", "layout");
    return hasil;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Transaksi gagal." };
  }
}
