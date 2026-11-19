import { db } from "@/lib/db";
import { wajibLogin } from "@/lib/auth";
import { parseTanggalKalenderUtc } from "@/lib/tanggal";

export type JenisPeriode = "harian" | "bulanan" | "tahunan";
const HARI_MS = 86_400_000;

function awalBulan(tahun: number, bulan: number) {
  return new Date(Date.UTC(tahun, bulan, 1));
}

function keRentangTimestamp(startDateMarker: Date, endDateMarker: Date) {
  return {
    awal: new Date(startDateMarker.getTime() - 7 * 60 * 60 * 1000),
    akhir: new Date(endDateMarker.getTime() - 7 * 60 * 60 * 1000),
  };
}

function tentukanRentang(jenis: JenisPeriode, tanggalInput: string) {
  const tanggal = parseTanggalKalenderUtc(tanggalInput);
  if (!tanggal) throw new Error("Tanggal laporan harus memakai format YYYY-MM-DD.");
  let awal: Date;
  let akhir: Date;

  if (jenis === "harian") {
    awal = tanggal;
    akhir = new Date(awal.getTime() + HARI_MS);
  } else if (jenis === "bulanan") {
    awal = awalBulan(tanggal.getUTCFullYear(), tanggal.getUTCMonth());
    akhir = awalBulan(tanggal.getUTCFullYear(), tanggal.getUTCMonth() + 1);
  } else if (jenis === "tahunan") {
    awal = awalBulan(tanggal.getUTCFullYear(), 0);
    akhir = awalBulan(tanggal.getUTCFullYear() + 1, 0);
  } else {
    throw new Error("Jenis periode laporan tidak dikenal.");
  }

  return { tanggalAwal: awal, tanggalAkhirEksklusif: akhir, ...keRentangTimestamp(awal, akhir) };
}

/**
 * Sumber data laporan keuangan. HPP transaksi lama yang belum memiliki snapshot
 * tidak dihitung sebagai nol; laba dinyatakan belum lengkap sampai HPP tersedia.
 */
export async function ambilLaporanKeuangan(jenis: JenisPeriode, tanggal: string) {
  const sesi = await wajibLogin(true);
  void sesi;
  const rentang = tentukanRentang(jenis, tanggal);
  const kondisiWaktu = { gte: rentang.awal, lt: rentang.akhir };

  const [transaksi, pengeluaran, pembayaranSupplier, pembelian, shift] = await Promise.all([
    db.transaksi.findMany({
      where: { waktu: kondisiWaktu },
      include: { kasir: { select: { id: true, nama: true } }, item: { include: { obat: true, batch: true } } },
      orderBy: { waktu: "asc" },
    }),
    db.pengeluaran.findMany({
      where: { waktu: kondisiWaktu },
      include: { petugas: { select: { id: true, nama: true } }, shift: true },
      orderBy: { waktu: "asc" },
    }),
    db.pembayaranSupplier.findMany({
      where: { waktu: kondisiWaktu },
      include: { pembelian: { include: { supplier: true } }, petugas: { select: { id: true, nama: true } }, shift: true },
      orderBy: { waktu: "asc" },
    }),
    db.pembelian.findMany({
      where: { tanggal: kondisiWaktu },
      include: { supplier: true, pembuat: { select: { id: true, nama: true } }, item: { include: { obat: true, batch: true } } },
      orderBy: { tanggal: "asc" },
    }),
    db.shift.findMany({
      where: { bukaPada: kondisiWaktu },
      include: { pengguna: { select: { id: true, nama: true } } },
      orderBy: { bukaPada: "asc" },
    }),
  ]);

  const omzetKotor = transaksi.reduce((sum, item) => sum + item.total + item.diskon, 0);
  const diskon = transaksi.reduce((sum, item) => sum + item.diskon, 0);
  const pendapatan = transaksi.reduce((sum, item) => sum + item.total, 0);
  const pendapatanTunai = transaksi.filter((item) => item.metode === "Tunai").reduce((sum, item) => sum + item.total, 0);
  const pendapatanNonTunai = pendapatan - pendapatanTunai;

  let hpp = 0;
  let jumlahItemHppBelumDiketahui = 0;
  for (const sale of transaksi) {
    for (const item of sale.item) {
      if (item.hargaPokok === null) jumlahItemHppBelumDiketahui++;
      else hpp += item.hargaPokok * item.jumlah;
    }
  }
  const hppLengkap = jumlahItemHppBelumDiketahui === 0;
  const labaKotor = hppLengkap ? pendapatan - hpp : null;
  const biayaOperasional = pengeluaran.reduce((sum, item) => sum + item.jumlah, 0);
  const labaBersih = labaKotor === null ? null : labaKotor - biayaOperasional;
  const pembayaranSupplierTunai = pembayaranSupplier.filter((item) => item.metode === "Tunai").reduce((sum, item) => sum + item.jumlah, 0);
  const pembayaranSupplierNonTunai = pembayaranSupplier.reduce((sum, item) => sum + item.jumlah, 0) - pembayaranSupplierTunai;
  const arusKas = pendapatanTunai - biayaOperasional - pembayaranSupplierTunai;
  const nilaiPembelian = pembelian.reduce((sum, item) => sum + item.total, 0);
  const utangSupplierTersisa = await db.pembelian.aggregate({
    where: { status: { in: ["Belum Lunas", "Parsial"] } },
    _sum: { total: true, terbayar: true },
  });
  const totalUtangSupplier = (utangSupplierTersisa._sum.total ?? 0) - (utangSupplierTersisa._sum.terbayar ?? 0);

  return {
    periode: { jenis, tanggalAwal: rentang.tanggalAwal, tanggalAkhirEksklusif: rentang.tanggalAkhirEksklusif },
    ringkasan: {
      jumlahTransaksi: transaksi.length,
      omzetKotor,
      diskon,
      pendapatan,
      pendapatanTunai,
      pendapatanNonTunai,
      hpp,
      hppLengkap,
      jumlahItemHppBelumDiketahui,
      labaKotor,
      biayaOperasional,
      labaBersih,
      pembayaranSupplierTunai,
      pembayaranSupplierNonTunai,
      nilaiPembelian,
      totalUtangSupplier,
      arusKas,
    },
    transaksi,
    pengeluaran,
    pembayaranSupplier,
    pembelian,
    shift,
  };
}
