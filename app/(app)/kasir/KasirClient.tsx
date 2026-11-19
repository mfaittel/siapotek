"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Minus, Trash2, Info } from "lucide-react";
import { bayar } from "./actions";
import { rupiah } from "@/lib/format";

type Obat = { id: number; kode: string; nama: string; kategori: string; satuan: string; harga: number; stok: number };
const KATEGORI = ["Semua obat", "Obat bebas", "Obat keras", "Suplemen"];
const METODE = ["Tunai", "QRIS", "Debit"];

export default function KasirClient({ obat }: { obat: Obat[] }) {
  const router = useRouter();
  const [cari, setCari] = useState("");
  const [kat, setKat] = useState(KATEGORI[0]);
  const [keranjang, setKeranjang] = useState<Record<number, number>>({});
  const [diskon, setDiskon] = useState(0);
  const [metode, setMetode] = useState("Tunai");
  const [tunai, setTunai] = useState(0);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const tampil = useMemo(
    () => obat.filter((o) => (kat === KATEGORI[0] || o.kategori === kat) && (o.nama + o.kode).toLowerCase().includes(cari.toLowerCase())),
    [obat, cari, kat],
  );
  const baris = obat.filter((o) => (keranjang[o.id] || 0) > 0);
  const subtotal = baris.reduce((a, o) => a + o.harga * keranjang[o.id], 0);
  const total = Math.max(0, subtotal - diskon);
  const kembalian = metode === "Tunai" ? Math.max(0, tunai - total) : 0;

  const ubah = (o: Obat, d: number) =>
    setKeranjang((p) => ({ ...p, [o.id]: Math.min(o.stok, Math.max(0, (p[o.id] || 0) + d)) }));

  async function proses() {
    setSibuk(true);
    const r = await bayar({
      items: baris.map((o) => ({ obatId: o.id, jumlah: keranjang[o.id] })),
      diskon, metode, tunai: metode === "Tunai" ? tunai : total,
    });
    setSibuk(false);
    if ("error" in r) { setPesan({ ok: false, teks: r.error }); return; }
    setPesan({ ok: true, teks: `${r.kode} lunas.${r.kembalian ? ` Kembalian ${rupiah(r.kembalian)}.` : ""}` });
    setKeranjang({}); setDiskon(0); setTunai(0);
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px] items-start">
      <div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-10" placeholder="Cari nama atau kode obat…" value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {KATEGORI.map((k) => (
            <button key={k} onClick={() => setKat(k)}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${kat === k ? "bg-lembut text-utama" : "bg-slate-100 text-slate-600"}`}>{k}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          {tampil.map((o) => (
            <div key={o.id} className="kartu p-4">
              <p className="font-bold">{o.nama}</p>
              <p className="text-[12px] text-slate-500">{o.kode} · Stok {o.stok} {o.satuan.toLowerCase()} · {o.kategori}</p>
              <div className="flex items-center justify-between mt-4">
                <p className="font-extrabold text-utama text-[18px]">{rupiah(o.harga)}</p>
                <button disabled={o.stok === 0} onClick={() => ubah(o, 1)} className="btn border border-bingkai text-utama disabled:opacity-40">
                  <Plus size={16} />Tambah
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3 p-4 rounded-kontrol bg-lembut text-[13px] text-utama">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p><b>Pengeluaran stok mengikuti FEFO.</b> Batch terdekat kedaluwarsa dipilih otomatis. Obat kedaluwarsa tidak dapat dijual.</p>
        </div>
      </div>

      <aside className="kartu p-5">
        <div className="flex justify-between items-start">
          <h2 className="font-bold text-[16px]">Keranjang</h2>
          <button onClick={() => setKeranjang({})} className="text-[12px] font-bold text-utama">Kosongkan</button>
        </div>
        {baris.length === 0 && <p className="mt-4 text-slate-500 text-[13px]">Belum ada obat. Klik Tambah pada daftar obat.</p>}
        {baris.map((o) => (
          <div key={o.id} className="mt-3 pb-3 border-b border-bingkai">
            <div className="flex justify-between"><p className="font-semibold">{o.nama}</p>
              <button onClick={() => setKeranjang((p) => ({ ...p, [o.id]: 0 }))} aria-label="Hapus"><Trash2 size={14} className="text-slate-500" /></button></div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 border border-bingkai rounded-kontrol">
                <button className="p-2" onClick={() => ubah(o, -1)} aria-label="Kurangi"><Minus size={12} /></button>
                <span className="w-6 text-center font-semibold">{keranjang[o.id]}</span>
                <button className="p-2" onClick={() => ubah(o, 1)} aria-label="Tambah"><Plus size={12} /></button>
              </div>
              <span className="text-[12px] text-slate-500">× {rupiah(o.harga)}</span>
              <b>{rupiah(o.harga * keranjang[o.id])}</b>
            </div>
          </div>
        ))}
        <div className="flex justify-between mt-4 text-slate-500"><span>Subtotal</span><b className="text-teks">{rupiah(subtotal)}</b></div>
        <label className="block mt-3 font-semibold text-[13px]">Diskon transaksi (Rp)</label>
        <input className="input mt-1" type="number" min={0} value={diskon || ""} onChange={(e) => setDiskon(Number(e.target.value) || 0)} />
        <div className="mt-3 flex justify-between items-center bg-lembut rounded-kontrol px-4 py-3 text-utama">
          <b>Total</b><b className="text-[22px]">{rupiah(total)}</b>
        </div>
        <p className="mt-4 text-[13px] font-semibold">Cara bayar</p>
        <div className="flex gap-2 mt-2">
          {METODE.map((m) => (
            <button key={m} onClick={() => setMetode(m)}
              className={`btn h-9 ${metode === m ? "bg-utama text-white" : "border border-bingkai text-utama"}`}>{m}</button>
          ))}
        </div>
        {metode === "Tunai" && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><label className="text-[13px] font-semibold">Tunai diterima (Rp)</label>
              <input className="input mt-1" type="number" min={0} value={tunai || ""} onChange={(e) => setTunai(Number(e.target.value) || 0)} /></div>
            <div><p className="text-[13px] text-slate-500">Kembalian</p><p className="mt-3 font-extrabold text-utama text-[18px]">{rupiah(kembalian)}</p></div>
          </div>
        )}
        {pesan && <p className={`mt-3 text-[13px] rounded-kontrol px-3 py-2 ${pesan.ok ? "bg-lembut text-utama" : "bg-red-50 text-error"}`}>{pesan.teks}</p>}
        <button disabled={sibuk || baris.length === 0} onClick={proses} className="btn-utama w-full mt-4 disabled:opacity-50">
          {sibuk ? "Memproses…" : `Bayar · ${rupiah(total)}`}
        </button>
      </aside>
    </div>
  );
}
