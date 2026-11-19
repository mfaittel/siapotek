"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";

type Hasil = { ok: true; id: number } | { ok: false; error: string };
const MAX_INT = 2_147_483_647;

/** Pengeluaran selalu terikat pada shift aktif agar dapat direkonsiliasi saat tutup kas. */
export async function catatPengeluaran(input: {
  nama: string;
  kategori: string;
  jumlah: number;
  catatan?: string;
}): Promise<Hasil> {
  const sesi = await wajibLogin();
  const nama = String(input?.nama ?? "").trim();
  const kategori = String(input?.kategori ?? "").trim();
  const catatan = String(input?.catatan ?? "").trim().slice(0, 500) || null;
  const jumlah = Number(input?.jumlah);
  if (!nama || nama.length > 100 || !kategori || kategori.length > 60) return { ok: false, error: "Nama dan kategori pengeluaran wajib diisi." };
  if (!Number.isSafeInteger(jumlah) || jumlah <= 0 || jumlah > MAX_INT) return { ok: false, error: "Nominal pengeluaran harus berupa angka bulat lebih dari nol." };

  try {
    const result = await db.$transaction(async (tx) => {
      const shift = await tx.shift.findFirst({ where: { penggunaId: sesi.id, kunciAktif: String(sesi.id), tutupPada: null } });
      if (!shift) throw new Error("Buka shift terlebih dahulu sebelum mencatat pengeluaran.");
      const expense = await tx.pengeluaran.create({
        data: { shiftId: shift.id, petugasId: sesi.id, nama, kategori, jumlah, catatan },
        select: { id: true },
      });
      return expense;
    });
    revalidatePath("/", "layout");
    return { ok: true, id: result.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Pengeluaran gagal dicatat." };
  }
}

/** Daftar pengeluaran pada rentang timestamp opsional. */
export async function daftarPengeluaran(filter: { dari?: Date; sampai?: Date; shiftId?: number } = {}) {
  await wajibLogin();
  return db.pengeluaran.findMany({
    where: {
      ...(filter.shiftId ? { shiftId: filter.shiftId } : {}),
      ...(filter.dari || filter.sampai ? { waktu: { ...(filter.dari ? { gte: filter.dari } : {}), ...(filter.sampai ? { lte: filter.sampai } : {}) } } : {}),
    },
    include: { petugas: { select: { id: true, nama: true } }, shift: { select: { id: true, bukaPada: true, tutupPada: true } } },
    orderBy: { waktu: "desc" },
    take: 500,
  });
}
