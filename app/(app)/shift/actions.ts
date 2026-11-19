"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";

type Hasil = { ok: true; id?: number; kasHarus?: number; selisih?: number } | { ok: false; error: string };
const BATAS_NOMINAL = 2_147_483_647;

function nominalValid(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= BATAS_NOMINAL;
}

/** Membuka shift untuk pengguna yang sedang login. Satu pengguna hanya boleh memiliki satu shift aktif. */
export async function bukaShift(input: { kasAwal: number; catatan?: string }): Promise<Hasil> {
  const sesi = await wajibLogin();
  if (!input || !nominalValid(input.kasAwal)) return { ok: false, error: "Kas awal harus berupa angka bulat yang valid." };
  const catatan = String(input.catatan ?? "").trim().slice(0, 500) || null;

  try {
    const shift = await db.shift.create({
      data: { penggunaId: sesi.id, kasAwal: input.kasAwal, catatanBuka: catatan, kunciAktif: String(sesi.id) },
      select: { id: true },
    });
    revalidatePath("/", "layout");
    return { ok: true, id: shift.id };
  } catch (error) {
    // Unique constraint pada kunciAktif juga melindungi dari dua permintaan bersamaan.
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002") {
      return { ok: false, error: "Kamu masih memiliki shift yang terbuka. Tutup shift sebelumnya terlebih dahulu." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Shift tidak dapat dibuka." };
  }
}

/** Menghitung kas yang seharusnya ada, lalu menutup shift secara atomik. */
export async function tutupShift(input: { kasAkhir: number; catatan?: string }): Promise<Hasil> {
  const sesi = await wajibLogin();
  if (!input || !nominalValid(input.kasAkhir)) return { ok: false, error: "Kas akhir harus berupa angka bulat yang valid." };
  const catatan = String(input.catatan ?? "").trim().slice(0, 500) || null;

  try {
    const hasil = await db.$transaction(async (tx) => {
      const shift = await tx.shift.findFirst({
        where: { penggunaId: sesi.id, kunciAktif: String(sesi.id), tutupPada: null },
      });
      if (!shift) throw new Error("Tidak ada shift aktif yang dapat ditutup.");

      const [penjualanTunai, pengeluaran, pembayaranSupplier] = await Promise.all([
        tx.transaksi.aggregate({ where: { shiftId: shift.id, metode: "Tunai" }, _sum: { total: true } }),
        tx.pengeluaran.aggregate({ where: { shiftId: shift.id }, _sum: { jumlah: true } }),
        tx.pembayaranSupplier.aggregate({ where: { shiftId: shift.id, metode: "Tunai" }, _sum: { jumlah: true } }),
      ]);

      const totalPenjualanTunai = penjualanTunai._sum.total ?? 0;
      const totalPengeluaran = pengeluaran._sum.jumlah ?? 0;
      const totalPembayaranSupplier = pembayaranSupplier._sum.jumlah ?? 0;
      const kasHarus = shift.kasAwal + totalPenjualanTunai - totalPengeluaran - totalPembayaranSupplier;
      if (!Number.isSafeInteger(kasHarus) || kasHarus < 0 || kasHarus > BATAS_NOMINAL) {
        throw new Error("Hasil perhitungan kas di luar batas yang didukung. Periksa transaksi shift.");
      }
      const selisih = input.kasAkhir - kasHarus;

      const update = await tx.shift.updateMany({
        where: { id: shift.id, kunciAktif: String(sesi.id), tutupPada: null },
        data: {
          tutupPada: new Date(),
          kunciAktif: null,
          kasHarus,
          kasAkhir: input.kasAkhir,
          selisihKas: selisih,
          catatanTutup: catatan,
        },
      });
      if (update.count !== 1) throw new Error("Shift berubah saat ditutup. Muat ulang lalu coba lagi.");
      return { kasHarus, selisih };
    }, { maxWait: 10_000, timeout: 20_000 });

    revalidatePath("/", "layout");
    return { ok: true, kasHarus: hasil.kasHarus, selisih: hasil.selisih };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Shift tidak dapat ditutup." };
  }
}

export async function ambilShiftAktifSaya() {
  const sesi = await wajibLogin();
  return db.shift.findFirst({
    where: { penggunaId: sesi.id, kunciAktif: String(sesi.id), tutupPada: null },
    include: { pengguna: { select: { id: true, nama: true } } },
  });
}
