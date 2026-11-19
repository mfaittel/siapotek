/** Helper tanggal operasional apotek menggunakan zona waktu Asia/Jakarta. */
const ZONA = "Asia/Jakarta";
const HARI_MS = 86_400_000;

function komponenTanggal(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const ambil = (type: "year" | "month" | "day") => {
    const raw = parts.find((part) => part.type === type)?.value;
    return raw ? Number(raw) : Number.NaN;
  };
  const value = { tahun: ambil("year"), bulan: ambil("month"), hari: ambil("day") };
  if (!Object.values(value).every(Number.isInteger)) {
    throw new Error("Tidak dapat menentukan tanggal operasional Asia/Jakarta.");
  }
  return value;
}

/** Penanda tanggal kalender di UTC 00:00. Cocok untuk kolom kedaluwarsa. */
export function awalHariJakartaUtc(now: Date = new Date()): Date {
  const { tahun, bulan, hari } = komponenTanggal(now);
  return new Date(Date.UTC(tahun, bulan - 1, hari));
}

/** Rentang timestamp [awal, akhir) untuk satu hari kalender Asia/Jakarta. */
export function rentangWaktuHariJakartaUtc(now: Date = new Date()) {
  const penandaTanggal = awalHariJakartaUtc(now);
  // WIB = UTC+07:00.
  const awal = new Date(penandaTanggal.getTime() - 7 * 60 * 60 * 1000);
  const akhir = new Date(awal.getTime() + HARI_MS);
  return { awal, akhir, penandaTanggal };
}

/** Mengubah input YYYY-MM-DD menjadi tanggal kalender UTC tanpa pergeseran zona waktu. */
export function parseTanggalKalenderUtc(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function tanggalKalenderJakarta(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function sisaHariKedaluwarsa(date: Date, now: Date = new Date()): number {
  const hariIni = awalHariJakartaUtc(now);
  const tanggalExp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return Math.round((tanggalExp.getTime() - hariIni.getTime()) / HARI_MS);
}

export const TAMBAH_HARI_MS = HARI_MS;
