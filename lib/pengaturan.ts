import { db } from "./db";

export const BAWAAN = { namaApotek: "Apotek Sehat Sentosa", cabang: "Bandung", buka: "08:00", tutup: "22:00" };
export type PengaturanApotek = typeof BAWAAN;

export async function ambilPengaturan(): Promise<PengaturanApotek> {
  const baris = await db.pengaturan.findMany();
  const h: Record<string, string> = {};
  for (const b of baris) h[b.kunci] = b.nilai;
  return {
    namaApotek: h.namaApotek || BAWAAN.namaApotek,
    cabang: h.cabang || BAWAAN.cabang,
    buka: h.buka || BAWAAN.buka,
    tutup: h.tutup || BAWAAN.tutup,
  };
}

export const jamTampil = (s: string) => s.replace(":", ".");

// Jam dihitung menurut WIB, apa pun zona waktu server.
export function sedangBuka(buka: string, tutup: string, sekarang = new Date()) {
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(sekarang);
  return tutup > buka ? t >= buka && t < tutup : t >= buka || t < tutup;
}
