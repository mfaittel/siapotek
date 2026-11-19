"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { parseTanggalKalenderUtc } from "@/lib/tanggal";

/** Penerimaan stok manual. Perubahan batch dan mutasi dilakukan atomik. */
export async function stokMasuk(fd: FormData) {
  const sesi = await wajibLogin();
  const obatId = Number(fd.get("obatId"));
  const supplierRaw = Number(fd.get("supplierId"));
  const supplierId = Number.isSafeInteger(supplierRaw) && supplierRaw > 0 ? supplierRaw : null;
  const kodeBatch = String(fd.get("kodeBatch") || "").trim().toUpperCase();
  const tanggalExp = String(fd.get("kedaluwarsa") || "").trim();
  const kedaluwarsa = parseTanggalKalenderUtc(tanggalExp);
  const jumlah = Number(fd.get("jumlah"));
  const invoice = String(fd.get("invoice") || "").trim().slice(0, 100) || "TANPA-INVOICE";

  if (
    !Number.isSafeInteger(obatId) || obatId <= 0 || !kodeBatch || kodeBatch.length > 80 ||
    !kedaluwarsa || !Number.isSafeInteger(jumlah) || jumlah <= 0 || jumlah > 2_147_483_647
  ) return;

  await db.$transaction(async (tx) => {
    const obat = await tx.obat.findUnique({ where: { id: obatId }, select: { id: true, hargaBeli: true } });
    if (!obat) throw new Error("Obat tidak ditemukan.");
    if (supplierId && !(await tx.supplier.findUnique({ where: { id: supplierId }, select: { id: true } }))) {
      throw new Error("Supplier tidak ditemukan.");
    }

    const lama = await tx.batch.findUnique({ where: { obatId_kodeBatch: { obatId, kodeBatch } } });
    if (lama && lama.kedaluwarsa.getTime() !== kedaluwarsa.getTime()) {
      throw new Error("Kode batch sudah tercatat dengan tanggal kedaluwarsa berbeda. Periksa nomor batch.");
    }

    const hargaMasuk = Number.isSafeInteger(obat.hargaBeli) && obat.hargaBeli > 0 ? obat.hargaBeli : null;
    const batch = await tx.batch.upsert({
      where: { obatId_kodeBatch: { obatId, kodeBatch } },
      update: { stok: { increment: jumlah }, ...(supplierId ? { supplierId } : {}) },
      create: { obatId, kodeBatch, kedaluwarsa, stok: jumlah, supplierId, hargaBeli: hargaMasuk },
    });

    if (hargaMasuk !== null) {
      const stokSebelumMasuk = batch.stok - jumlah;
      // Jika HPP lama tidak diketahui sementara masih ada stok, jangan menebak HPP-nya.
      if (stokSebelumMasuk === 0) {
        await tx.batch.update({ where: { id: batch.id }, data: { hargaBeli: hargaMasuk } });
      } else if (lama?.hargaBeli !== null && lama?.hargaBeli !== undefined) {
        const nilaiLama = BigInt(stokSebelumMasuk) * BigInt(lama.hargaBeli);
        const nilaiMasuk = BigInt(jumlah) * BigInt(hargaMasuk);
        const kuantitasTotal = BigInt(batch.stok);
        const hargaRata = Number((nilaiLama + nilaiMasuk + kuantitasTotal / 2n) / kuantitasTotal);
        if (!Number.isSafeInteger(hargaRata) || hargaRata < 0 || hargaRata > 2_147_483_647) {
          throw new Error("Perhitungan harga beli batch melebihi batas nominal yang didukung.");
        }
        await tx.batch.update({ where: { id: batch.id }, data: { hargaBeli: hargaRata } });
      }
    }

    await tx.mutasi.create({
      data: { batchId: batch.id, jenis: "Pembelian", jumlah, referensi: invoice, petugasId: sesi.id },
    });
  }, { maxWait: 10_000, timeout: 20_000 });

  revalidatePath("/", "layout");
  redirect("/stok?tab=daftar");
}

/** Penyesuaian stok fisik dan pencatatan selisih dilakukan dalam satu transaksi. */
export async function sesuaikan(fd: FormData) {
  const sesi = await wajibLogin();
  const batchId = Number(fd.get("batchId"));
  const fisik = Number(fd.get("fisik"));
  const alasan = String(fd.get("alasan") || "").trim();
  const catatan = String(fd.get("catatan") || "").trim().slice(0, 500);

  if (
    !Number.isSafeInteger(batchId) || batchId <= 0 || !Number.isSafeInteger(fisik) ||
    fisik < 0 || fisik > 2_147_483_647 || !alasan || !catatan
  ) return;

  await db.$transaction(async (tx) => {
    const batch = await tx.batch.findUnique({ where: { id: batchId } });
    if (!batch || batch.stok === fisik) return;

    const perubahan = await tx.batch.updateMany({
      where: { id: batchId, stok: batch.stok },
      data: { stok: fisik },
    });
    if (perubahan.count !== 1) throw new Error("Stok batch berubah saat penyesuaian. Muat ulang halaman lalu coba lagi.");

    await tx.mutasi.create({
      data: { batchId, jenis: "Penyesuaian", jumlah: fisik - batch.stok, referensi: alasan, catatan, petugasId: sesi.id },
    });
  }, { maxWait: 10_000, timeout: 20_000 });

  revalidatePath("/", "layout");
  redirect("/stok?tab=penyesuaian");
}
