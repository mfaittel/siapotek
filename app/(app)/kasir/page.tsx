import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { awalHariJakartaUtc } from "@/lib/tanggal";
import KasirClient from "./KasirClient";

export default async function Kasir() {
  await wajibLogin();
  const awalHari = awalHariJakartaUtc();
  const obat = await db.obat.findMany({ include: { batch: true }, orderBy: { nama: "asc" } });
  const daftar = obat.map((o) => ({
    id: o.id,
    kode: o.kode,
    nama: o.nama,
    kategori: o.kategori,
    satuan: o.satuan,
    harga: o.hargaJual,
    stok: o.batch
      .filter((b) => b.kedaluwarsa >= awalHari && b.stok > 0)
      .reduce((total, b) => total + b.stok, 0),
  }));

  return (
    <div className="max-w-[1200px] mx-auto">
      <h1 className="text-[26px] font-extrabold">Kasir</h1>
      <p className="text-slate-500 mb-5">Pelayanan cepat, transaksi tercatat dengan tepat.</p>
      <KasirClient obat={daftar} />
    </div>
  );
}
