import Link from "next/link";
import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { rupiah } from "@/lib/format";
import { KATEGORI, SATUAN, PERAN, SANDI_MIN } from "@/lib/master";
import Tab from "@/components/Tab";
import Lencana from "@/components/Lencana";
import { simpanObat, hapusObat, simpanSupplier, hapusSupplier, simpanPengguna, aturUlangSandi } from "./actions";

export const dynamic = "force-dynamic";
const TABS = [{ k: "obat", label: "Obat" }, { k: "supplier", label: "Supplier" }, { k: "pengguna", label: "Pengguna" }];
const L = "font-semibold text-[13px]";

type Q = { tab?: string; edit?: string; ok?: string; galat?: string };

export default async function DataMaster({ searchParams }: { searchParams: Q }) {
  const s = await wajibLogin(true); // khusus Admin, termasuk jika alamatnya diketik langsung
  const tab = TABS.some((t) => t.k === searchParams.tab) ? searchParams.tab! : "obat";
  const edit = Number(searchParams.edit) || 0;

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-[26px] font-extrabold">Data master</h1>
      <p className="text-slate-500 mb-5">Kelola daftar obat, supplier, dan akun pengguna.</p>
      <Tab tabs={TABS} aktif={tab} dasar="/data-master" />

      {searchParams.ok && <p className="mb-4 text-[13px] text-sukses bg-green-50 border border-green-200 rounded-kontrol px-3 py-2">{searchParams.ok}</p>}
      {searchParams.galat && <p className="mb-4 text-[13px] text-error bg-red-50 border border-error rounded-kontrol px-3 py-2">{searchParams.galat}</p>}

      {tab === "obat" && <Obat edit={edit} />}
      {tab === "supplier" && <Supplier edit={edit} />}
      {tab === "pengguna" && <Pengguna edit={edit} saya={s.id} />}
    </div>
  );
}

const Batal = ({ tab }: { tab: string }) => (
  <Link href={`/data-master?tab=${tab}`} className="btn h-11 border border-bingkai text-slate-600 hover:bg-slate-50">Batal</Link>
);

async function Obat({ edit }: { edit: number }) {
  const obat = await db.obat.findMany({ orderBy: { kode: "asc" }, include: { _count: { select: { batch: true, item: true } } } });
  const o = obat.find((x) => x.id === edit);
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="kartu p-5 overflow-x-auto">
        <table className="tabel">
          <thead><tr><th>Kode / nama</th><th>Kategori</th><th>Satuan</th><th>Harga beli</th><th>Harga jual</th><th>Stok min.</th><th></th></tr></thead>
          <tbody>
            {obat.length === 0 && <tr><td colSpan={7} className="text-slate-500">Belum ada obat. Tambahkan obat pertama lewat formulir di samping.</td></tr>}
            {obat.map((x) => {
              const terpakai = x._count.batch > 0 || x._count.item > 0;
              return (
                <tr key={x.id} className={x.id === edit ? "bg-lembut/40" : ""}>
                  <td><b>{x.nama}</b><br /><span className="text-[12px] text-slate-500">{x.kode}</span></td>
                  <td><Lencana label={x.kategori} kelas="bg-slate-100 text-slate-600" /></td>
                  <td>{x.satuan}</td><td>{rupiah(x.hargaBeli)}</td><td className="text-utama font-semibold">{rupiah(x.hargaJual)}</td><td>{x.minimum}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`/data-master?tab=obat&edit=${x.id}`} className="text-[12px] font-bold text-utama">Ubah</Link>
                    {!terpakai && (
                      <form action={hapusObat} className="inline"><input type="hidden" name="id" value={x.id} />
                        <button className="ml-3 text-[12px] font-bold text-error">Hapus</button></form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-[12px] text-slate-500">Obat yang sudah punya batch atau riwayat transaksi tidak bisa dihapus, supaya laporan tetap utuh. Harga yang diubah hanya berlaku untuk transaksi berikutnya.</p>
      </div>

      <form key={o?.id ?? "baru"} action={simpanObat} className="kartu p-5 grid gap-3">
        <h2 className="font-bold">{o ? `Ubah ${o.nama}` : "Tambah obat"}</h2>
        {o && <input type="hidden" name="id" value={o.id} />}
        <div><label className={L}>Kode</label><input name="kode" required defaultValue={o?.kode ?? ""} className="input mt-1" placeholder="OBT-008" /></div>
        <div><label className={L}>Nama obat</label><input name="nama" required defaultValue={o?.nama ?? ""} className="input mt-1" placeholder="Ibuprofen 400 mg" /></div>
        <div><label className={L}>Kategori</label>
          <select name="kategori" defaultValue={o?.kategori ?? KATEGORI[0]} className="input mt-1">{KATEGORI.map((k) => <option key={k}>{k}</option>)}</select></div>
        <div><label className={L}>Satuan</label>
          <input name="satuan" required list="daftar-satuan" defaultValue={o?.satuan ?? ""} className="input mt-1" placeholder="Strip" />
          <datalist id="daftar-satuan">{SATUAN.map((x) => <option key={x} value={x} />)}</datalist></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Harga beli (Rp)</label><input name="hargaBeli" type="number" min={0} step={1} required defaultValue={o?.hargaBeli ?? ""} className="input mt-1" /></div>
          <div><label className={L}>Harga jual (Rp)</label><input name="hargaJual" type="number" min={1} step={1} required defaultValue={o?.hargaJual ?? ""} className="input mt-1" /></div>
        </div>
        <div><label className={L}>Stok minimum</label><input name="minimum" type="number" min={0} step={1} required defaultValue={o?.minimum ?? ""} className="input mt-1" />
          <p className="mt-1 text-[12px] text-slate-500">Peringatan muncul saat stok layak jual di bawah angka ini.</p></div>
        <div className="flex gap-2"><button className="btn-utama flex-1">{o ? "Simpan perubahan" : "Tambah obat"}</button>{o && <Batal tab="obat" />}</div>
      </form>
    </div>
  );
}

async function Supplier({ edit }: { edit: number }) {
  const sup = await db.supplier.findMany({ orderBy: { nama: "asc" }, include: { _count: { select: { batch: true } } } });
  const s = sup.find((x) => x.id === edit);
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="kartu p-5 overflow-x-auto">
        <table className="tabel">
          <thead><tr><th>Nama supplier</th><th>Batch tercatat</th><th></th></tr></thead>
          <tbody>
            {sup.length === 0 && <tr><td colSpan={3} className="text-slate-500">Belum ada supplier. Tambahkan lewat formulir di samping.</td></tr>}
            {sup.map((x) => (
              <tr key={x.id} className={x.id === edit ? "bg-lembut/40" : ""}>
                <td><b>{x.nama}</b></td><td>{x._count.batch}</td>
                <td className="whitespace-nowrap text-right">
                  <Link href={`/data-master?tab=supplier&edit=${x.id}`} className="text-[12px] font-bold text-utama">Ubah</Link>
                  {x._count.batch === 0 && (
                    <form action={hapusSupplier} className="inline"><input type="hidden" name="id" value={x.id} />
                      <button className="ml-3 text-[12px] font-bold text-error">Hapus</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[12px] text-slate-500">Supplier yang masih tercatat pada batch tidak bisa dihapus.</p>
      </div>

      <form key={s?.id ?? "baru"} action={simpanSupplier} className="kartu p-5 grid gap-3">
        <h2 className="font-bold">{s ? `Ubah ${s.nama}` : "Tambah supplier"}</h2>
        {s && <input type="hidden" name="id" value={s.id} />}
        <div><label className={L}>Nama supplier</label><input name="nama" required defaultValue={s?.nama ?? ""} className="input mt-1" placeholder="PT Contoh Farma" /></div>
        <div className="flex gap-2"><button className="btn-utama flex-1">{s ? "Simpan perubahan" : "Tambah supplier"}</button>{s && <Batal tab="supplier" />}</div>
      </form>
    </div>
  );
}

async function Pengguna({ edit, saya }: { edit: number; saya: number }) {
  const user = await db.pengguna.findMany({ orderBy: [{ aktif: "desc" }, { nama: "asc" }] });
  const u = user.find((x) => x.id === edit);
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="kartu p-5 overflow-x-auto">
        <table className="tabel">
          <thead><tr><th>Nama / email</th><th>Peran</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {user.map((x) => (
              <tr key={x.id} className={x.id === edit ? "bg-lembut/40" : ""}>
                <td><b>{x.nama}</b>{x.id === saya && <span className="ml-2 text-[11px] text-slate-500">(Anda)</span>}<br /><span className="text-[12px] text-slate-500">{x.email}</span></td>
                <td>{x.peran}</td>
                <td><Lencana label={x.aktif ? "Aktif" : "Nonaktif"} kelas={x.aktif ? "bg-green-50 text-sukses" : "bg-slate-100 text-slate-600"} /></td>
                <td className="text-right"><Link href={`/data-master?tab=pengguna&edit=${x.id}`} className="text-[12px] font-bold text-utama">Ubah</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[12px] text-slate-500">Akun tidak dihapus agar riwayat transaksi dan mutasi stok tetap menunjukkan siapa petugasnya. Nonaktifkan akun yang tidak dipakai lagi; akses langsung tertutup.</p>
      </div>

      <div className="grid gap-5">
        <form key={u?.id ?? "baru"} action={simpanPengguna} className="kartu p-5 grid gap-3">
          <h2 className="font-bold">{u ? `Ubah ${u.nama}` : "Tambah pengguna"}</h2>
          {u && <input type="hidden" name="id" value={u.id} />}
          <div><label className={L}>Nama lengkap</label><input name="nama" required defaultValue={u?.nama ?? ""} className="input mt-1" /></div>
          <div><label className={L}>Email</label><input name="email" type="email" required defaultValue={u?.email ?? ""} className="input mt-1" placeholder="nama@sehatsentosa.id" /></div>
          <div><label className={L}>Peran</label>
            <select name="peran" defaultValue={u?.peran ?? "Staf"} className="input mt-1">{PERAN.map((p) => <option key={p}>{p}</option>)}</select>
            <p className="mt-1 text-[12px] text-slate-500">Staf tidak bisa membuka Data Master, Pengaturan, dan Rekap Omset.</p></div>
          {!u && <div><label className={L}>Kata sandi awal</label><input name="sandi" type="password" required minLength={SANDI_MIN} className="input mt-1" />
            <p className="mt-1 text-[12px] text-slate-500">Minimal {SANDI_MIN} karakter.</p></div>}
          {u && <label className="flex items-center gap-2 text-[13px] font-semibold"><input type="checkbox" name="aktif" defaultChecked={u.aktif} className="w-4 h-4 accent-teal-700" />Akun aktif</label>}
          <div className="flex gap-2"><button className="btn-utama flex-1">{u ? "Simpan perubahan" : "Buat akun"}</button>{u && <Batal tab="pengguna" />}</div>
        </form>

        {u && (
          <form action={aturUlangSandi} className="kartu p-5 grid gap-3">
            <h2 className="font-bold">Atur ulang kata sandi</h2>
            <input type="hidden" name="id" value={u.id} />
            <div><label className={L}>Kata sandi baru untuk {u.nama.split(" ")[0]}</label><input name="sandi" type="password" required minLength={SANDI_MIN} className="input mt-1" /></div>
            <button className="btn h-11 border border-utama text-utama hover:bg-lembut/40">Atur ulang kata sandi</button>
          </form>
        )}
      </div>
    </div>
  );
}
