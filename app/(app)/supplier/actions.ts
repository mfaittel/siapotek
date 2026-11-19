"use server";

import { wajibLogin } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Data supplier untuk integrasi halaman frontend berikutnya.
 * Tidak mengubah desain atau halaman supplier yang sudah ada.
 */
export async function daftarSupplier() {
  await wajibLogin();
  return db.supplier.findMany({ orderBy: { nama: "asc" } });
}

export async function detailSupplier(id: number) {
  await wajibLogin();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return db.supplier.findUnique({
    where: { id },
    include: {
      pembelian: {
        include: { item: { include: { obat: true, batch: true } }, pembayaran: { orderBy: { waktu: "desc" } } },
        orderBy: { tanggal: "desc" },
      },
    },
  });
}
