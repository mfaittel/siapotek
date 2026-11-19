import { db } from "./db";
import { awalHariJakartaUtc, rentangWaktuHariJakartaUtc, TAMBAH_HARI_MS } from "./tanggal";

export const HARI = TAMBAH_HARI_MS;

export async function ringkasan() {
  const { awal, akhir, penandaTanggal } = rentangWaktuHariJakartaUtc();
  const akhir90 = new Date(penandaTanggal.getTime() + 90 * HARI);
  const [obat, transaksi, pengeluaran, pembayaranSupplier] = await Promise.all([
    db.obat.findMany({ include: { batch: true } }),
    db.transaksi.findMany({
      where: { waktu: { gte: awal, lt: akhir } },
      include: { item: { select: { jumlah: true, hargaPokok: true } } },
    }),
    db.pengeluaran.findMany({ where: { waktu: { gte: awal, lt: akhir } }, select: { jumlah: true } }),
    db.pembayaranSupplier.findMany({
      where: { waktu: { gte: awal, lt: akhir }, metode: "Tunai" },
      select: { jumlah: true },
    }),
  ]);

  let unitStok = 0;
  let kedaluwarsa = 0;
  let stokMinimum = 0;
  for (const obatItem of obat) {
    let layakJual = 0;
    for (const batch of obatItem.batch) {
      if (batch.stok > 0 && batch.kedaluwarsa <= akhir90) kedaluwarsa++;
      if (batch.kedaluwarsa >= penandaTanggal) {
        layakJual += batch.stok;
        unitStok += batch.stok;
      }
    }
    if (layakJual < obatItem.minimum) stokMinimum++;
  }

  let hpp = 0;
  let hppBelumDiketahui = 0;
  for (const transaksiItem of transaksi) {
    for (const item of transaksiItem.item) {
      if (item.hargaPokok === null) hppBelumDiketahui++;
      else hpp += item.jumlah * item.hargaPokok;
    }
  }

  const omset = transaksi.reduce((sum, t) => sum + t.total, 0);
  const totalPengeluaran = pengeluaran.reduce((sum, x) => sum + x.jumlah, 0);
  const totalPembayaranSupplier = pembayaranSupplier.reduce((sum, x) => sum + x.jumlah, 0);
  const labaKotor = hppBelumDiketahui === 0 ? omset - hpp : null;

  return {
    jenisObat: obat.length,
    unitStok,
    kedaluwarsa,
    stokMinimum,
    perhatian: kedaluwarsa + stokMinimum,
    transaksi: transaksi.length,
    omset,
    hpp,
    hppBelumDiketahui,
    labaKotor,
    pengeluaran: totalPengeluaran,
    pembayaranSupplierTunai: totalPembayaranSupplier,
    arusKasBersih: omset - totalPengeluaran - totalPembayaranSupplier,
    awalHari: awal,
  };
}

/** Helper eksplisit untuk validasi hari operasional pada action dan query backend. */
export function hariOperasional() {
  return awalHariJakartaUtc();
}
