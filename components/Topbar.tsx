import { keluar } from "@/app/login/actions";
import { Bell, ChevronDown } from "lucide-react";
import { tanggalHariIni } from "@/lib/format";
import { jamTampil, sedangBuka, type PengaturanApotek } from "@/lib/pengaturan";

export default function Topbar({ nama, peran, apotek }: { nama: string; peran: string; apotek: PengaturanApotek }) {
  const buka = sedangBuka(apotek.buka, apotek.tutup);
  const inisial = nama.split(" ").map((k) => k[0]).join("").slice(0, 2);
  return (
    <header className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-bingkai">
      <div className="leading-tight">
        <p className="font-bold">{apotek.namaApotek}</p>
        <p className="text-[12px] text-slate-500">{tanggalHariIni()}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className={`hidden sm:block text-[12px] font-semibold px-3 py-1 rounded-full ${buka ? "text-sukses bg-green-50" : "text-slate-600 bg-slate-100"}`}>
          {buka ? "Apotek buka" : "Apotek tutup"} · {jamTampil(apotek.buka)}–{jamTampil(apotek.tutup)}
        </span>
        <Bell size={18} className="text-slate-500" />
        <div className="flex items-center gap-2">
          <div className="grid place-items-center w-10 h-10 rounded-full bg-lembut text-utama font-bold">{inisial}</div>
          <div className="leading-tight">
            <p className="font-semibold text-[13px]">{nama}</p>
            <p className="text-[11px] text-slate-500">{peran}</p>
          </div>
          <ChevronDown size={16} className="text-slate-500" />
          <form action={keluar}><button className="ml-2 text-[12px] font-bold text-error">Keluar</button></form>
        </div>
      </div>
    </header>
  );
}
