import Link from "next/link";
import { Plus, Package, ShoppingCart, AlertTriangle, Wallet } from "lucide-react";
import { wajibLogin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ringkasan, HARI } from "@/lib/data";
import { rupiah, tanggalHariIni, tanggal, sisaHari } from "@/lib/format";
import { awalHariJakartaUtc } from "@/lib/tanggal";
import Lencana from "@/components/Lencana";

function Kartu({ judul, nilai, catatan, ikon: Ikon, merah }: {
  judul: string; nilai: string | number; catatan: string; ikon: React.ElementType; merah?: boolean;
}) {
  return (
    <div className="kartu p-5">
      <div className="flex items-center justify-between text-slate-500 text-[13px]">
        {judul}<Ikon size={16} className={merah ? "text-error" : "text-utama"} />
      </div>
      <p className="mt-2 text-[32px] font-extrabold leading-none">{nilai}</p>
      <p className={`mt-3 text-[12px] ${merah ? "text-error" : "text-slate-500"}`}>{catatan}</p>
    </div>
  );
}

export default async function Beranda() {
  const s = await wajibLogin();
  const admin = s.peran === "Admin";
  const r = await ringkasan();
  const awalHari = awalHariJakartaUtc();
  const batas90Hari = new Date(awalHari.getTime() + 90 * HARI);
  const batch = await db.batch.findMany({
    where: { stok: { gt: 0 }, kedaluwarsa: { lte: batas90Hari } },
    include: { obat: true }, orderBy: { kedaluwarsa: "asc" }, take: 3,
  });
  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold">Selamat pagi, {s.nama.split(" ")[0]}</h1>
          <p className="text-slate-500">Ringkasan operasional apotek hari ini, {tanggalHariIni()}.</p>
        </div>
        <Link href="/kasir" className="btn-utama"><Plus size={16} />Transaksi baru</Link>
      </div>

      <div className={`mt-6 grid gap-4 sm:grid-cols-2 ${admin ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Kartu judul="Total jenis obat" nilai={r.jenisObat} catatan={`${r.unitStok.toLocaleString("id-ID")} unit stok aktif`} ikon={Package} />
        <Kartu judul="Transaksi hari ini" nilai={r.transaksi} catatan="Tercatat sejak pukul 00.00" ikon={ShoppingCart} />
        <Kartu judul="Perlu perhatian" nilai={r.perhatian} catatan={`${r.kedaluwarsa} kedaluwarsa · ${r.stokMinimum} stok minimum`} ikon={AlertTriangle} merah />
        {admin && <Kartu judul="Omset hari ini" nilai={rupiah(r.omset)} catatan="Setelah diskon transaksi" ikon={Wallet} />}
      </div>

      <section className="kartu mt-6 p-5">
        <div className="flex justify-between">
          <h2 className="font-bold text-[16px]">Perlu ditindaklanjuti</h2>
          <Link href="/peringatan" className="text-[12px] font-bold text-utama">Lihat peringatan</Link>
        </div>
        <ul className="mt-3 divide-y divide-bingkai">
          {batch.length === 0 && <li className="py-3 text-slate-500">Tidak ada batch yang perlu ditindaklanjuti.</li>}
          {batch.map((b) => {
            const hari = sisaHari(b.kedaluwarsa);
            return (
              <li key={b.id} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{b.obat.nama}</p>
                  <Lencana label={hari < 0 ? "Prioritas" : "Segera"} kelas={hari < 0 ? "bg-red-50 text-error" : "bg-amber-50 text-amber-700"} />
                </div>
                <p className="text-[12px] text-slate-500 mt-1">
                  {b.kodeBatch} · {b.stok} {b.obat.satuan.toLowerCase()} · {hari < 0 ? `kedaluwarsa ${tanggal(b.kedaluwarsa)}` : `sisa ${hari} hari`}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
