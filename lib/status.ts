import { awalHariJakartaUtc } from "@/lib/tanggal";

export function statusBatch(stok: number, minimum: number, exp: Date) {
  if (exp < awalHariJakartaUtc()) return { label: "Kedaluwarsa", kelas: "bg-red-50 text-error" };
  if (stok < minimum / 2) return { label: "Kritis", kelas: "bg-red-50 text-error" };
  if (stok < minimum) return { label: "Segera habis", kelas: "bg-amber-50 text-amber-700" };
  return { label: "Aman", kelas: "bg-green-50 text-sukses" };
}
