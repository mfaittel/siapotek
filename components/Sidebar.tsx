"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShoppingCart, Package, Bell, LineChart, Database, Settings, Plus } from "lucide-react";
import type { MenuItem } from "@/lib/nav";

const ikon: Record<string, React.ElementType> = {
  beranda: LayoutGrid, kasir: ShoppingCart, stok: Package, peringatan: Bell,
  laporan: LineChart, data: Database, pengaturan: Settings,
};

export default function Sidebar({ menu, peran, apotek, cabang }: { menu: MenuItem[]; peran: string; apotek: string; cabang: string }) {
  const path = usePathname();
  return (
    <aside className="hidden md:flex w-[72px] lg:w-[224px] shrink-0 flex-col bg-white border-r border-bingkai px-3 py-5">
      <div className="flex items-center gap-2 px-1">
        <div className="grid place-items-center w-9 h-9 rounded-kontrol bg-utama text-white"><Plus size={20} /></div>
        <div className="hidden lg:block leading-tight">
          <p className="font-extrabold text-utama text-[17px]">SIAPOTEK</p>
          <p className="text-[9px] tracking-wide text-slate-500 uppercase max-w-[150px] truncate">{apotek}</p>
        </div>
      </div>
      <p className="hidden lg:block mt-6 px-1 text-[12px] text-slate-500">Cabang {cabang} · {peran}</p>
      <nav className="mt-4 flex flex-col gap-1">
        {menu.map((m) => {
          const Ikon = ikon[m.ikon];
          const aktif = path.startsWith(m.href);
          return (
            <Link key={m.href} href={m.href} title={m.label}
              className={`flex items-center gap-3 h-11 px-3 rounded-kontrol font-medium ${
                aktif ? "bg-lembut text-utama" : "text-slate-600 hover:bg-slate-50"}`}>
              <Ikon size={18} />
              <span className="hidden lg:block flex-1">{m.label}</span>
              {!!m.badge && <span className="hidden lg:block text-[12px] font-bold text-error">{m.badge}</span>}
            </Link>
          );
        })}
      </nav>
      <p className="hidden lg:block mt-auto px-1 text-[11px] text-utama">Terhubung · Sinkron 09.42 WIB</p>
    </aside>
  );
}
