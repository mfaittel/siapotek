import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { HARI } from "@/lib/data";
import { tanggal, sisaHari } from "@/lib/format";
import Tab from "@/components/Tab";
import Lencana from "@/components/Lencana";
import { awalHariJakartaUtc } from "@/lib/tanggal";

export const dynamic = "force-dynamic";
export default async function Peringatan({ searchParams }: { searchParams: { tab?: string } }) {
  await wajibLogin();
  const tabList = [{ k: "kedaluwarsa", label: "Kedaluwarsa" }, { k: "minimum", label: "Stok Minimum" }];
  const tab = tabList.some((item) => item.k === searchParams.tab) ? searchParams.tab! : "kedaluwarsa";
  const now = awalHariJakartaUtc();
  const batas90Hari = new Date(now.getTime() + 90 * HARI);
  const batch = await db.batch.findMany({
    where: { stok: { gt: 0 }, kedaluwarsa: { lte: batas90Hari } },
    include: { obat: true, supplier: true }, orderBy: { kedaluwarsa: "asc" },
  });
  const obat = await db.obat.findMany({ include: { batch: true } });
  const minim = obat
    .map((o) => ({ ...o, layak: o.batch.filter((b) => b.kedaluwarsa >= now).reduce((a, b) => a + b.stok, 0) }))
    .filter((o) => o.layak < o.minimum);

  const sudah = batch.filter((b) => sisaHari(b.kedaluwarsa) < 0).length;
  const d30 = batch.filter((b) => { const h = sisaHari(b.kedaluwarsa); return h >= 0 && h <= 30; }).length;
  const d90 = batch.length - sudah - d30;

  const Ringkas = ({ judul, nilai, merah }: { judul: string; nilai: string; merah?: boolean }) => (
    <div className="kartu p-5"><p className="text-slate-500 text-[13px]">{judul}</p>
      <p className={`mt-2 text-[28px] font-extrabold ${merah ? "text-error" : ""}`}>{nilai}</p></div>
  );

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-[26px] font-extrabold">Peringatan stok</h1>
      <p className="text-slate-500 mb-5">Tindak lanjuti lebih awal untuk pelayanan yang aman.</p>
      <Tab tabs={[{ k: "kedaluwarsa", label: `Kedaluwarsa (${batch.length})` }, { k: "minimum", label: `Stok Minimum (${minim.length})` }]} aktif={tab} dasar="/peringatan" />

      {tab === "kedaluwarsa" ? (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Ringkas judul="Sudah kedaluwarsa" nilai={`${sudah} batch`} merah />
            <Ringkas judul="Kedaluwarsa ≤30 hari" nilai={`${d30} batch`} />
            <Ringkas judul="Kedaluwarsa 31–90 hari" nilai={`${d90} batch`} />
          </div>
          <div className="mt-4 rounded-kontrol bg-red-50 text-error px-4 py-3 text-[13px]">
            <b>Obat kedaluwarsa diblokir dari kasir.</b> Pisahkan batch kedaluwarsa secara fisik, hubungi supplier untuk retur, dan catat penyesuaian stok.
          </div>
          <div className="kartu p-5 mt-4 overflow-x-auto">
            <table className="tabel">
              <thead><tr><th>Nama / batch</th><th>Kedaluwarsa</th><th>Sisa stok</th><th>Supplier</th><th>Prioritas</th></tr></thead>
              <tbody>
                {batch.map((b) => {
                  const h = sisaHari(b.kedaluwarsa);
                  return (
                    <tr key={b.id}>
                      <td><b>{b.obat.nama}</b><br /><span className="text-[12px] text-slate-500">{b.kodeBatch}</span></td>
                      <td>{tanggal(b.kedaluwarsa)}<br /><span className="text-[12px] text-slate-500">{h < 0 ? `Lewat ${-h} hari` : `Sisa ${h} hari`}</span></td>
                      <td>{b.stok} {b.obat.satuan.toLowerCase()}</td><td>{b.supplier?.nama ?? "-"}</td>
                      <td><Lencana label={h < 0 ? "Kedaluwarsa" : h <= 30 ? "≤30 hari" : "31–90 hari"} kelas={h < 0 ? "bg-red-50 text-error" : h <= 30 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="kartu p-5 overflow-x-auto">
          <table className="tabel">
            <thead><tr><th>Nama obat</th><th>Stok layak jual / minimum</th><th>Kekurangan</th><th>Prioritas</th></tr></thead>
            <tbody>
              {minim.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.nama}</b><br /><span className="text-[12px] text-slate-500">{o.kode}</span></td>
                  <td>{o.layak} / {o.minimum} {o.satuan.toLowerCase()}</td><td>{o.minimum - o.layak} {o.satuan.toLowerCase()}</td>
                  <td><Lencana label={o.layak === 0 ? "Habis" : o.layak < o.minimum / 2 ? "Kritis" : "Rendah"} kelas={o.layak < o.minimum / 2 ? "bg-red-50 text-error" : "bg-amber-50 text-amber-700"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
