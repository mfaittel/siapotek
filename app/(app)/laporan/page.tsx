import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { rupiah, tanggal, tanggalWaktuJakarta } from "@/lib/format";
import Tab from "@/components/Tab";

export const dynamic = "force-dynamic";
export default async function Laporan({ searchParams }: { searchParams: { tab?: string } }) {
  const s = await wajibLogin();
  const admin = s.peran === "Admin";
  const tabs = [{ k: "stok", label: "Stok Saat Ini" }, { k: "mutasi", label: "Mutasi Stok" }, ...(admin ? [{ k: "omset", label: "Rekap Omset" }] : [])];
  // Staf tidak boleh membuka Rekap Omset, walau mengetik alamatnya langsung.
  const tab = tabs.some((t) => t.k === searchParams.tab) ? searchParams.tab! : "stok";

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-[26px] font-extrabold">Laporan</h1>
      <p className="text-slate-500 mb-5">Data operasional yang rapi untuk keputusan yang lebih tepat.</p>
      <Tab tabs={tabs} aktif={tab} dasar="/laporan" />
      {tab === "stok" && <StokSaatIni />}
      {tab === "mutasi" && <Mutasi />}
      {tab === "omset" && admin && <Omset />}
    </div>
  );
}

async function StokSaatIni() {
  const batch = await db.batch.findMany({ where: { stok: { gt: 0 } }, include: { obat: true }, orderBy: { obat: { nama: "asc" } } });
  const unit = batch.reduce((a, b) => a + b.stok, 0);
  const nilai = batch.reduce((a, b) => a + b.stok * (b.hargaBeli ?? b.obat.hargaBeli), 0);
  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        {[["Jenis obat", String(new Set(batch.map((b) => b.obatId)).size)], ["Total stok", unit.toLocaleString("id-ID")], ["Nilai persediaan", rupiah(nilai)]].map(([j, n]) => (
          <div key={j} className="kartu p-5"><p className="text-slate-500 text-[13px]">{j}</p><p className="mt-2 text-[28px] font-extrabold">{n}</p></div>
        ))}
      </div>
      <div className="kartu p-5 overflow-x-auto">
        <table className="tabel">
          <thead><tr><th>Nama / kode</th><th>Batch</th><th>Kedaluwarsa</th><th>Stok</th><th>Satuan</th><th>Harga beli</th><th>Nilai stok</th></tr></thead>
          <tbody>{batch.map((b) => (
            <tr key={b.id}><td><b>{b.obat.nama}</b><br /><span className="text-[12px] text-slate-500">{b.obat.kode}</span></td>
              <td>{b.kodeBatch}</td><td>{tanggal(b.kedaluwarsa)}</td><td>{b.stok}</td><td>{b.obat.satuan}</td>
              <td>{rupiah(b.hargaBeli ?? b.obat.hargaBeli)}</td><td className="text-utama">{rupiah(b.stok * (b.hargaBeli ?? b.obat.hargaBeli))}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

async function Mutasi() {
  const m = await db.mutasi.findMany({ include: { batch: { include: { obat: true } }, petugas: true }, orderBy: { waktu: "desc" }, take: 50 });
  return (
    <div className="kartu p-5 overflow-x-auto">
      <h2 className="font-bold">Mutasi Stok</h2>
      <p className="text-[12px] text-slate-500 mb-3">50 pergerakan stok terbaru. Setiap perubahan dapat ditelusuri.</p>
      <table className="tabel">
        <thead><tr><th>Waktu / referensi</th><th>Obat / batch</th><th>Jenis</th><th>Masuk</th><th>Keluar</th><th>Petugas</th></tr></thead>
        <tbody>{m.map((x) => (
          <tr key={x.id}>
            <td>{x.waktu.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}<br /><span className="text-[12px] text-slate-500">{x.referensi}</span></td>
            <td><b>{x.batch.obat.nama}</b><br /><span className="text-[12px] text-slate-500">{x.batch.kodeBatch}</span></td>
            <td>{x.jenis}</td><td>{x.jumlah > 0 ? x.jumlah : "—"}</td><td>{x.jumlah < 0 ? -x.jumlah : "—"}</td><td>{x.petugas.nama.split(" ")[0]}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

async function Omset() {
  const trx = await db.transaksi.findMany({ orderBy: { waktu: "desc" } });
  const hari = new Map<string, { n: number; diskon: number; bersih: number; tunai: number; non: number }>();
  for (const t of trx) {
    const k = tanggalWaktuJakarta(t.waktu);
    const h = hari.get(k) ?? { n: 0, diskon: 0, bersih: 0, tunai: 0, non: 0 };
    h.n++; h.diskon += t.diskon; h.bersih += t.total;
    if (t.metode === "Tunai") h.tunai += t.total; else h.non += t.total;
    hari.set(k, h);
  }
  const bersih = trx.reduce((a, t) => a + t.total, 0);
  const diskon = trx.reduce((a, t) => a + t.diskon, 0);
  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        {[["Omset bersih", rupiah(bersih)], ["Transaksi selesai", String(trx.length)], ["Diskon diberikan", rupiah(diskon)]].map(([j, n]) => (
          <div key={j} className="kartu p-5"><p className="text-slate-500 text-[13px]">{j}</p><p className="mt-2 text-[28px] font-extrabold">{n}</p></div>
        ))}
      </div>
      <div className="kartu p-5 overflow-x-auto">
        <h2 className="font-bold">Rekap Omset</h2>
        <p className="text-[12px] text-slate-500 mb-3">Pendapatan penjualan bersih · Hanya dapat diakses Admin</p>
        <table className="tabel">
          <thead><tr><th>Tanggal</th><th>Transaksi</th><th>Omset kotor</th><th>Diskon</th><th>Omset bersih</th><th>Tunai</th><th>Nontunai</th></tr></thead>
          <tbody>
            {hari.size === 0 && <tr><td colSpan={7} className="text-slate-500">Belum ada transaksi. Coba buat satu di menu Kasir.</td></tr>}
            {[...hari].map(([k, h]) => (
              <tr key={k}><td><b>{k}</b></td><td>{h.n}</td><td>{rupiah(h.bersih + h.diskon)}</td><td>{rupiah(h.diskon)}</td><td>{rupiah(h.bersih)}</td><td>{rupiah(h.tunai)}</td><td className="text-utama">{rupiah(h.non)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
