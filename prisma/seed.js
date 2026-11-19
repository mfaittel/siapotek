const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const db = new PrismaClient();

async function supplier(nama) {
  const existing = await db.supplier.findFirst({ where: { nama } });
  return existing ?? db.supplier.create({ data: { nama } });
}

async function main() {
  // Akun contoh hanya dibuat saat belum ada. Menjalankan seed ulang tidak mereset kata sandi.
  const sandi = await bcrypt.hash("apotek123", 10);
  await db.pengguna.upsert({
    where: { email: "alya@sehatsentosa.id" },
    update: {},
    create: { nama: "Alya Rahma", email: "alya@sehatsentosa.id", sandi, peran: "Admin" },
  });
  await db.pengguna.upsert({
    where: { email: "dina@sehatsentosa.id" },
    update: {},
    create: { nama: "Dina Nurhaliza", email: "dina@sehatsentosa.id", sandi, peran: "Staf" },
  });

  const kimiaFarma = await supplier("PT Kimia Farma");
  const enseval = await supplier("PT Enseval");
  const argon = await supplier("PT Anugrah Argon");

  // [kode, nama, kategori, satuan, beli, jual, minimum, supplier, [[batch, expiry, qty], ...]]
  const data = [
    ["OBT-001", "Paracetamol 500 mg", "Obat bebas", "Strip", 5000, 7500, 50, kimiaFarma, [["PCM2608", "2028-08-31", 240]]],
    ["OBT-002", "Amoxicillin 500 mg", "Obat keras", "Strip", 8000, 12000, 40, kimiaFarma, [["AMX2511", "2026-11-20", 36], ["AMX2609", "2028-09-30", 60]]],
    ["OBT-003", "Vitamin C 500 mg", "Suplemen", "Botol", 13000, 18000, 30, enseval, [["VTC2606", "2028-06-30", 84]]],
    ["OBT-004", "Cetirizine 10 mg", "Obat keras", "Strip", 8000, 10000, 20, argon, [["CTZ2510", "2026-11-05", 12]]],
    ["OBT-005", "Oralit 200 ml", "Obat bebas", "Sachet", 2000, 3500, 25, enseval, [["ORL2604", "2028-04-30", 8]]],
    ["OBT-006", "Omeprazole 20 mg", "Obat keras", "Strip", 8000, 15000, 30, argon, [["OMP2607", "2028-07-31", 120]]],
    ["OBT-007", "Loratadine 10 mg", "Obat keras", "Strip", 8000, 12000, 20, enseval, [["LOR2512", "2026-12-01", 18]]],
  ];

  for (const [kode, nama, kategori, satuan, hargaBeli, hargaJual, minimum, sup, batches] of data) {
    const obat = await db.obat.upsert({
      where: { kode },
      update: {},
      create: { kode, nama, kategori, satuan, hargaBeli, hargaJual, minimum },
    });

    for (const [kodeBatch, exp, stok] of batches) {
      const existing = await db.batch.findUnique({ where: { obatId_kodeBatch: { obatId: obat.id, kodeBatch } } });
      if (!existing) {
        await db.batch.create({
          data: {
            obatId: obat.id,
            kodeBatch,
            kedaluwarsa: new Date(`${exp}T00:00:00.000Z`),
            stok,
            hargaBeli,
            supplierId: sup.id,
          },
        });
      }
    }
  }

  const defaults = {
    namaApotek: "Apotek Sehat Sentosa",
    cabang: "Bandung",
    buka: "08:00",
    tutup: "22:00",
  };
  for (const [kunci, nilai] of Object.entries(defaults)) {
    await db.pengaturan.upsert({ where: { kunci }, update: {}, create: { kunci, nilai } });
  }

  console.log("Seed selesai. Akun contoh hanya dibuat jika belum tersedia.");
  console.log("Admin awal: alya@sehatsentosa.id | Staf awal: dina@sehatsentosa.id | Kata sandi awal: apotek123");
  console.log("Ganti kata sandi contoh sebelum aplikasi dipakai operasional.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
