import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { tanggal, sisaHari } from "@/lib/format";
import { statusBatch } from "@/lib/status";
import Tab from "@/components/Tab";
import Lencana from "@/components/Lencana";
import { stokMasuk, sesuaikan } from "./actions";

export const dynamic = "force-dynamic";
const TABS = [{ k: "daftar", label: "Daftar Stok" }, { k: "masuk", label: "Stok Masuk" }, { k: "penyesuaian", label: "Penyesuaian Stok" }];

export default async function Stok({ searchParams }: { searchParams: { tab?: string } }) {
  await wajibLogin();
  const tab = TABS.some((item) => item.k === searchParams.tab) ? searchParams.tab! : "daftar";
  const batch = await db.batch.findMany({ include: { obat: true, supplier: true }, orderBy: [{ obat: { nama: "asc" } }, { kedaluwarsa: "asc" }] });
  const obat = await db.obat.findMany({ orderBy: { nama: "asc" } });
  const supplier = await db.supplier.findMany();

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-[26px] font-extrabold">Stok obat</h1>
      <p className="text-slate-500 mb-5">Pantau setiap batch, jaga ketersediaan dan kualitas obat.</p>
      <Tab tabs={TABS} aktif={tab} dasar="/stok" />

      {tab === "daftar" && (
        <div className="kartu p-5 overflow-x-auto">
          <table className="tabel">
            <thead><tr><th>Nama / kode</th><th>Batch</th><th>Kedaluwarsa</th><th>Stok / min.</th><th>Satuan</th><th>Supplier</th><th>Status</th></tr></thead>
            <tbody>
              {batch.map((b) => {
                const st = statusBatch(b.stok, b.obat.minimum, b.kedaluwarsa);
                return (
                  <tr key={b.id}>
                    <td><b>{b.obat.nama}</b><br /><span className="text-slate-500 text-[12px]">{b.obat.kode}</span></td>
                    <td>{b.kodeBatch}</td>
                    <td>{tanggal(b.kedaluwarsa)}<br /><span className="text-[12px] text-slate-500">{sisaHari(b.kedaluwarsa) < 0 ? "Sudah lewat" : `Sisa ${sisaHari(b.kedaluwarsa)} hari`}</span></td>
                    <td>{b.stok} / {b.obat.minimum}</td><td>{b.obat.satuan}</td><td>{b.supplier?.nama ?? "-"}</td>
                    <td><Lencana {...st} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "masuk" && (
        <form action={stokMasuk} className="kartu p-5 grid sm:grid-cols-2 gap-4 max-w-[760px]">
          <div><label className="font-semibold text-[13px]">Obat</label>
            <select name="obatId" required className="input mt-1">{obat.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}</select></div>
          <div><label className="font-semibold text-[13px]">Supplier</label>
            <select name="supplierId" className="input mt-1">{supplier.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select></div>
          <div><label className="font-semibold text-[13px]">Nomor invoice</label><input name="invoice" className="input mt-1" placeholder="INV-KF-1126-018" /></div>
          <div><label className="font-semibold text-[13px]">Kode batch</label><input name="kodeBatch" required className="input mt-1" placeholder="PCM2608" /></div>
          <div><label className="font-semibold text-[13px]">Kedaluwarsa</label><input name="kedaluwarsa" type="date" required className="input mt-1" /></div>
          <div><label className="font-semibold text-[13px]">Jumlah</label><input name="jumlah" type="number" min={1} required className="input mt-1" /></div>
          <button className="btn-utama sm:col-span-2">Simpan stok masuk</button>
        </form>
      )}

      {tab === "penyesuaian" && (
        <form action={sesuaikan} className="kartu p-5 grid gap-4 max-w-[560px]">
          <div><label className="font-semibold text-[13px]">Obat dan batch</label>
            <select name="batchId" required className="input mt-1">
              {batch.map((b) => <option key={b.id} value={b.id}>{b.obat.nama} · {b.kodeBatch} (stok sistem {b.stok})</option>)}
            </select></div>
          <div><label className="font-semibold text-[13px]">Stok fisik</label><input name="fisik" type="number" min={0} required className="input mt-1" /></div>
          <div><label className="font-semibold text-[13px]">Alasan penyesuaian</label>
            <select name="alasan" className="input mt-1"><option>Kemasan rusak</option><option>Stok opname</option><option>Koreksi pencatatan</option></select></div>
          <div><label className="font-semibold text-[13px]">Catatan wajib</label><input name="catatan" required className="input mt-1" /></div>
          <p className="text-[12px] text-slate-500">Setiap perubahan tersimpan di laporan Mutasi Stok dan tidak dapat dihapus. Koreksi dilakukan dengan penyesuaian baru.</p>
          <button className="btn-utama">Simpan penyesuaian</button>
        </form>
      )}
    </div>
  );
}
