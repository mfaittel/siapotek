import type { Peran } from "./auth";

export type MenuItem = { label: string; href: string; ikon: string; badge?: number };

const semua: (MenuItem & { admin?: boolean })[] = [
  { label: "Beranda", href: "/beranda", ikon: "beranda" },
  { label: "Kasir", href: "/kasir", ikon: "kasir" },
  { label: "Stok", href: "/stok", ikon: "stok" },
  { label: "Peringatan", href: "/peringatan", ikon: "peringatan" },
  { label: "Laporan", href: "/laporan", ikon: "laporan" },
  { label: "Data Master", href: "/data-master", ikon: "data", admin: true },
  { label: "Pengaturan", href: "/pengaturan", ikon: "pengaturan", admin: true },
];

// Admin: 7 menu. Staf: 5 menu (sesuai matriks hak akses di desain).
export const menuUntuk = (peran: Peran): MenuItem[] =>
  semua.filter((m) => peran === "Admin" || !m.admin);
