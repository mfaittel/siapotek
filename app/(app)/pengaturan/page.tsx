import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { ambilPengaturan, jamTampil, sedangBuka } from "@/lib/pengaturan";
import { SANDI_MIN } from "@/lib/master";
import Tab from "@/components/Tab";
import { simpanApotek, gantiNama, gantiSandi } from "./actions";

export const dynamic = "force-dynamic";
const TABS = [{ k: "apotek", label: "Profil Apotek" }, { k: "akun", label: "Akun Saya" }];
const L = "font-semibold text-[13px]";

export default async function Pengaturan({ searchParams }: { searchParams: { tab?: string; ok?: string; galat?: string } }) {
  const s = await wajibLogin(true);
  const tab = TABS.some((t) => t.k === searchParams.tab) ? searchParams.tab! : "apotek";

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-[26px] font-extrabold">Pengaturan</h1>
      <p className="text-slate-500 mb-5">Atur identitas apotek dan keamanan akun Anda.</p>
      <Tab tabs={TABS} aktif={tab} dasar="/pengaturan" />

      {searchParams.ok && <p className="mb-4 text-[13px] text-sukses bg-green-50 border border-green-200 rounded-kontrol px-3 py-2">{searchParams.ok}</p>}
      {searchParams.galat && <p className="mb-4 text-[13px] text-error bg-red-50 border border-error rounded-kontrol px-3 py-2">{searchParams.galat}</p>}

      {tab === "apotek" && <Apotek />}
      {tab === "akun" && <Akun id={s.id} />}
    </div>
  );
}

async function Apotek() {
  const p = await ambilPengaturan();
  const buka = sedangBuka(p.buka, p.tutup);
  return (
    <form action={simpanApotek} className="kartu p-5 grid sm:grid-cols-2 gap-4 max-w-[760px]">
      <div className="sm:col-span-2"><label className={L}>Nama apotek</label><input name="namaApotek" required maxLength={60} defaultValue={p.namaApotek} className="input mt-1" />
        <p className="mt-1 text-[12px] text-slate-500">Tampil di bagian atas setiap halaman.</p></div>
      <div className="sm:col-span-2"><label className={L}>Cabang</label><input name="cabang" required maxLength={40} defaultValue={p.cabang} className="input mt-1" /></div>
      <div><label className={L}>Jam buka</label><input name="buka" type="time" required defaultValue={p.buka} className="input mt-1" /></div>
      <div><label className={L}>Jam tutup</label><input name="tutup" type="time" required defaultValue={p.tutup} className="input mt-1" /></div>
      <p className="sm:col-span-2 text-[12px] text-slate-500">
        Saat ini apotek tercatat {buka ? "buka" : "tutup"} ({jamTampil(p.buka)}–{jamTampil(p.tutup)} WIB). Jam tutup lebih awal dari jam buka dianggap buka melewati tengah malam.
      </p>
      <button className="btn-utama sm:col-span-2">Simpan profil apotek</button>
    </form>
  );
}

async function Akun({ id }: { id: number }) {
  const u = await db.pengguna.findUniqueOrThrow({ where: { id } });
  return (
    <div className="grid gap-5 max-w-[560px]">
      <form action={gantiNama} className="kartu p-5 grid gap-3">
        <h2 className="font-bold">Profil</h2>
        <div><label className={L}>Nama lengkap</label><input name="nama" required defaultValue={u.nama} className="input mt-1" /></div>
        <div><label className={L}>Email</label><input value={u.email} readOnly disabled className="input mt-1 bg-slate-50 text-slate-500" />
          <p className="mt-1 text-[12px] text-slate-500">Email diubah lewat Data Master › Pengguna.</p></div>
        <button className="btn-utama">Simpan nama</button>
      </form>

      <form action={gantiSandi} className="kartu p-5 grid gap-3">
        <h2 className="font-bold">Ganti kata sandi</h2>
        <div><label className={L}>Kata sandi saat ini</label><input name="lama" type="password" required autoComplete="current-password" className="input mt-1" /></div>
        <div><label className={L}>Kata sandi baru</label><input name="baru" type="password" required minLength={SANDI_MIN} autoComplete="new-password" className="input mt-1" />
          <p className="mt-1 text-[12px] text-slate-500">Minimal {SANDI_MIN} karakter.</p></div>
        <div><label className={L}>Ulangi kata sandi baru</label><input name="ulang" type="password" required minLength={SANDI_MIN} autoComplete="new-password" className="input mt-1" /></div>
        <button className="btn-utama">Ganti kata sandi</button>
      </form>
    </div>
  );
}
