import { awalHariJakartaUtc, sisaHariKedaluwarsa, tanggalKalenderJakarta } from "@/lib/tanggal";

export const rupiah = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
export const tanggalHariIni = () =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
/** Digunakan untuk kolom tanggal kalender seperti tanggal kedaluwarsa/jatuh tempo. */
export const tanggal = (d: Date) => tanggalKalenderJakarta(d);
/** Format timestamp transaksi memakai tanggal dan jam operasional Asia/Jakarta. */
export const tanggalWaktuJakarta = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
export const sisaHari = (d: Date) => sisaHariKedaluwarsa(d);
export const awalHariOperasional = () => awalHariJakartaUtc();
