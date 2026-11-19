"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { awalHariJakartaUtc, parseTanggalKalenderUtc } from "@/lib/tanggal";

type ItemPembelianInput = {
  obatId: number;
  kodeBatch: string;
  kedaluwarsa: string;
  jumlah: number;
  hargaBeli: number;
};
type BuatPembelianInput = {
  supplierId: number;
  nomorInvoice?: string;
  tanggal?: string;
  jatuhTempo?: string;
  catatan?: string;
  dibayarSekarang?: number;
  metodePembayaran?: "Tunai" | "Transfer" | "QRIS";
  items: ItemPembelianInput[];
};
type Hasil = { ok: true; id: number; kode: string; total: number; sisaTagihan: number } | { ok: false; error: string };

const MAX_INT = 2_147_483_647;
const METODE = ["Tunai", "Transfer", "QRIS"] as const;
const validInt = (n: unknown, min = 0): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= MAX_INT;

function normalisasiItems(raw: unknown): ItemPembelianInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) return null;
  const seen = new Set<string>();
  const items: ItemPembelianInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const item = row as ItemPembelianInput;
    const obatId = Number(item.obatId);
    const jumlah = Number(item.jumlah);
    const hargaBeli = Number(item.hargaBeli);
    const kodeBatch = String(item.kodeBatch ?? "").trim().toUpperCase();
    const kedaluwarsa = String(item.kedaluwarsa ?? "").trim();
    if (!validInt(obatId, 1) || !validInt(jumlah, 1) || !validInt(hargaBeli, 1) || !kodeBatch || kodeBatch.length > 80 || !parseTanggalKalenderUtc(kedaluwarsa)) return null;
    const key = `${obatId}:${kodeBatch}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const subtotal = jumlah * hargaBeli;
    if (!Number.isSafeInteger(subtotal) || subtotal > MAX_INT) return null;
    items.push({ obatId, jumlah, hargaBeli, kodeBatch, kedaluwarsa });
  }
  return items;
}

function statusPembelian(total: number, terbayar: number) {
  if (terbayar >= total) return "Lunas";
  if (terbayar > 0) return "Parsial";
  return "Belum Lunas";
}

/**
 * Membuat pembelian, menambah stok, mencatat HPP batch, mutasi, dan pembayaran awal.
 * Seluruh operasi berada dalam satu transaksi database.
 */
export async function buatPembelian(input: BuatPembelianInput): Promise<Hasil> {
  const sesi = await wajibLogin(true);
  if (!input || typeof input !== "object") return { ok: false, error: "Data pembelian tidak valid." };
  const items = normalisasiItems(input.items);
  if (!items) return { ok: false, error: "Rincian pembelian tidak valid atau terdapat batch ganda." };
  if (!validInt(Number(input.supplierId), 1)) return { ok: false, error: "Supplier wajib dipilih." };

  const tanggalBeli = input.tanggal ? parseTanggalKalenderUtc(input.tanggal) : awalHariJakartaUtc();
  const jatuhTempo = input.jatuhTempo ? parseTanggalKalenderUtc(input.jatuhTempo) : null;
  if (!tanggalBeli || (input.jatuhTempo && !jatuhTempo)) return { ok: false, error: "Tanggal pembelian atau jatuh tempo tidak valid." };
  if (jatuhTempo && jatuhTempo < tanggalBeli) return { ok: false, error: "Jatuh tempo tidak boleh sebelum tanggal pembelian." };

  const dibayarSekarang = Number(input.dibayarSekarang ?? 0);
  if (!validInt(dibayarSekarang)) return { ok: false, error: "Pembayaran awal tidak valid." };
  const metode = input.metodePembayaran ?? "Tunai";
  if (!(METODE as readonly string[]).includes(metode)) return { ok: false, error: "Metode pembayaran supplier tidak dikenal." };

  const total = items.reduce((sum, item) => sum + item.jumlah * item.hargaBeli, 0);
  if (!validInt(total, 1)) return { ok: false, error: "Total pembelian melebihi batas nominal yang didukung." };
  if (dibayarSekarang > total) return { ok: false, error: "Pembayaran awal tidak boleh melebihi total pembelian." };

  const nomorInvoice = String(input.nomorInvoice ?? "").trim().slice(0, 100) || null;
  const catatan = String(input.catatan ?? "").trim().slice(0, 500) || null;
  const penandaTanggal = new Date(Date.UTC(tanggalBeli.getUTCFullYear(), tanggalBeli.getUTCMonth(), tanggalBeli.getUTCDate()));
  const tanggalKode = `${String(penandaTanggal.getUTCDate()).padStart(2, "0")}${String(penandaTanggal.getUTCMonth() + 1).padStart(2, "0")}${String(penandaTanggal.getUTCFullYear()).slice(-2)}`;
  const kode = `BL-${tanggalKode}-${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    const hasil = await db.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: Number(input.supplierId) } });
      if (!supplier) throw new Error("Supplier tidak ditemukan.");

      let shiftId: number | null = null;
      if (dibayarSekarang > 0 && metode === "Tunai") {
        const shift = await tx.shift.findFirst({ where: { penggunaId: sesi.id, kunciAktif: String(sesi.id), tutupPada: null } });
        if (!shift) throw new Error("Pembayaran tunai supplier harus dilakukan saat shift aktif.");
        shiftId = shift.id;
      }

      const pembelian = await tx.pembelian.create({
        data: {
          kode,
          supplierId: supplier.id,
          nomorInvoice,
          tanggal: tanggalBeli,
          jatuhTempo,
          total,
          terbayar: dibayarSekarang,
          status: statusPembelian(total, dibayarSekarang),
          catatan,
          pembuatId: sesi.id,
        },
        select: { id: true },
      });

      for (const item of items) {
        const obat = await tx.obat.findUnique({ where: { id: item.obatId } });
        if (!obat) throw new Error(`Obat dengan ID ${item.obatId} tidak ditemukan.`);
        const expiry = parseTanggalKalenderUtc(item.kedaluwarsa)!;
        if (expiry < tanggalBeli) throw new Error(`Batch ${item.kodeBatch} sudah kedaluwarsa sebelum tanggal pembelian.`);

        const existing = await tx.batch.findUnique({ where: { obatId_kodeBatch: { obatId: item.obatId, kodeBatch: item.kodeBatch } } });
        if (existing && existing.kedaluwarsa.getTime() !== expiry.getTime()) {
          throw new Error(`Batch ${item.kodeBatch} sudah terdaftar dengan tanggal kedaluwarsa berbeda.`);
        }

        const batch = await tx.batch.upsert({
          where: { obatId_kodeBatch: { obatId: item.obatId, kodeBatch: item.kodeBatch } },
          update: { stok: { increment: item.jumlah }, supplierId: supplier.id },
          create: {
            obatId: item.obatId,
            kodeBatch: item.kodeBatch,
            kedaluwarsa: expiry,
            stok: item.jumlah,
            hargaBeli: item.hargaBeli,
            supplierId: supplier.id,
          },
        });

        if (existing) {
          const stokLama = existing.stok;
          if (stokLama === 0 || existing.hargaBeli !== null) {
            const hargaRata = stokLama === 0
              ? item.hargaBeli
              : Number((BigInt(stokLama) * BigInt(existing.hargaBeli!) + BigInt(item.jumlah) * BigInt(item.hargaBeli) + BigInt(batch.stok) / 2n) / BigInt(batch.stok));
            if (!Number.isSafeInteger(hargaRata) || hargaRata < 0 || hargaRata > MAX_INT) throw new Error("Harga rata-rata batch di luar batas nominal yang didukung.");
            await tx.batch.update({ where: { id: batch.id }, data: { hargaBeli: hargaRata } });
          }
          // Jika HPP stok lama belum diketahui, harga batch tetap NULL sampai stok lama habis.
        }

        const subtotal = item.jumlah * item.hargaBeli;
        await tx.pembelianItem.create({
          data: { pembelianId: pembelian.id, obatId: obat.id, batchId: batch.id, jumlah: item.jumlah, hargaBeli: item.hargaBeli, subtotal },
        });
        await tx.mutasi.create({
          data: { batchId: batch.id, jenis: "Pembelian", jumlah: item.jumlah, referensi: kode, petugasId: sesi.id },
        });
      }

      if (dibayarSekarang > 0) {
        await tx.pembayaranSupplier.create({
          data: {
            pembelianId: pembelian.id,
            shiftId,
            petugasId: sesi.id,
            jumlah: dibayarSekarang,
            metode,
            catatan: "Pembayaran awal saat pembelian dibuat",
          },
        });
      }
      return { id: pembelian.id, sisaTagihan: total - dibayarSekarang };
    }, { maxWait: 10_000, timeout: 30_000 });

    revalidatePath("/", "layout");
    return { ok: true, id: hasil.id, kode, total, sisaTagihan: hasil.sisaTagihan };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Pembelian gagal disimpan." };
  }
}

/** Mencatat pembayaran lanjutan atas tagihan supplier, termasuk pembayaran parsial. */
export async function bayarTagihanSupplier(input: {
  pembelianId: number;
  jumlah: number;
  metode: "Tunai" | "Transfer" | "QRIS";
  catatan?: string;
}): Promise<{ ok: true; sisaTagihan: number; status: string } | { ok: false; error: string }> {
  const sesi = await wajibLogin(true);
  if (!input || !validInt(Number(input.pembelianId), 1) || !validInt(Number(input.jumlah), 1)) {
    return { ok: false, error: "Nominal pembayaran tidak valid." };
  }
  if (!(METODE as readonly string[]).includes(input.metode)) return { ok: false, error: "Metode pembayaran tidak dikenal." };

  try {
    const result = await db.$transaction(async (tx) => {
      const pembelian = await tx.pembelian.findUnique({ where: { id: Number(input.pembelianId) } });
      if (!pembelian) throw new Error("Tagihan pembelian tidak ditemukan.");
      const sisa = pembelian.total - pembelian.terbayar;
      if (sisa <= 0) throw new Error("Tagihan ini sudah lunas.");
      if (input.jumlah > sisa) throw new Error(`Pembayaran melebihi sisa tagihan ${sisa}.`);

      let shiftId: number | null = null;
      if (input.metode === "Tunai") {
        const shift = await tx.shift.findFirst({ where: { penggunaId: sesi.id, kunciAktif: String(sesi.id), tutupPada: null } });
        if (!shift) throw new Error("Pembayaran tunai supplier harus dilakukan saat shift aktif.");
        shiftId = shift.id;
      }

      const terbayar = pembelian.terbayar + input.jumlah;
      const status = statusPembelian(pembelian.total, terbayar);
      const update = await tx.pembelian.updateMany({
        where: { id: pembelian.id, terbayar: pembelian.terbayar },
        data: { terbayar, status },
      });
      if (update.count !== 1) throw new Error("Saldo tagihan berubah bersamaan. Muat ulang lalu coba lagi.");

      await tx.pembayaranSupplier.create({
        data: {
          pembelianId: pembelian.id,
          shiftId,
          petugasId: sesi.id,
          jumlah: input.jumlah,
          metode: input.metode,
          catatan: String(input.catatan ?? "").trim().slice(0, 500) || null,
        },
      });
      return { sisaTagihan: pembelian.total - terbayar, status };
    }, { maxWait: 10_000, timeout: 20_000 });

    revalidatePath("/", "layout");
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Pembayaran supplier gagal." };
  }
}

/** Query backend untuk daftar tagihan yang belum lunas. */
export async function daftarTagihanSupplier(filter: { hanyaJatuhTempo?: boolean } = {}) {
  await wajibLogin(true);
  const awalHari = awalHariJakartaUtc();
  return db.pembelian.findMany({
    where: {
      status: { in: ["Belum Lunas", "Parsial"] },
      ...(filter.hanyaJatuhTempo ? { jatuhTempo: { lte: awalHari } } : {}),
    },
    include: { supplier: true, pembuat: { select: { id: true, nama: true } }, pembayaran: { orderBy: { waktu: "desc" } } },
    orderBy: [{ jatuhTempo: "asc" }, { tanggal: "desc" }],
  });
}
