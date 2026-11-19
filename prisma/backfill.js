const fs = require("node:fs");
const path = require("node:path");

// Prisma Client yang dijalankan langsung oleh Node tidak otomatis membaca .env.
// Isi variabel dari root proyek hanya jika belum disediakan oleh shell.
function muatEnv() {
  const file = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  const isi = fs.readFileSync(file, "utf8");
  for (const line of isi.split(/\r?\n/)) {
    const cocok = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!cocok || Object.prototype.hasOwnProperty.call(process.env, cocok[1])) continue;
    let value = cocok[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    process.env[cocok[1]] = value.replace(/\\n/g, "\n");
  }
}

muatEnv();
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL belum diatur. Salin .env.example menjadi .env atau atur variabel DATABASE_URL di shell.');
}

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function pastikanSchemaSudahTerpasang() {
  const tabel = [
    { nama: "Batch", kolom: "hargaBeli" },
    { nama: "Transaksi", kolom: "dibayar" },
    { nama: "Transaksi", kolom: "kembalian" },
    { nama: "ItemTransaksi", kolom: "hargaPokok" },
  ];
  for (const target of tabel) {
    const kolom = await db.$queryRawUnsafe(`PRAGMA table_info("${target.nama}")`);
    if (!Array.isArray(kolom) || !kolom.some((item) => item.name === target.kolom)) {
      throw new Error(
        `Kolom ${target.nama}.${target.kolom} belum ada di database yang dituju. Jalankan "npm run db:setup" dari root proyek dan pastikan DATABASE_URL menunjuk ke database yang benar.`,
      );
    }
  }
}

/**
 * Mengisi harga beli batch lama dari harga beli master sebagai estimasi.
 * Tidak pernah mengisi HPP transaksi lama atau pembayaran yang sudah lewat.
 */
async function main() {
  await pastikanSchemaSudahTerpasang();
  const batches = await db.batch.findMany({
    where: { hargaBeli: null },
    select: { id: true, obat: { select: { hargaBeli: true } } },
  });

  let diperbarui = 0;
  for (const batch of batches) {
    const harga = batch.obat.hargaBeli;
    if (!Number.isSafeInteger(harga) || harga <= 0) continue;
    const result = await db.batch.updateMany({
      where: { id: batch.id, hargaBeli: null },
      data: { hargaBeli: harga },
    });
    diperbarui += result.count;
  }
  console.log(`Backfill selesai. ${diperbarui} batch diberi estimasi harga beli.`);
  console.log("Item transaksi lama tetap HPP NULL karena harga pokok historis tidak tersedia.");
}

main()
  .catch((error) => {
    console.error("Backfill gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
