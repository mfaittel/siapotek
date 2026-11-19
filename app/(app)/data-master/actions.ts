"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buatSesi, wajibLogin } from "@/lib/auth";
import { KATEGORI, PERAN, SANDI_MIN } from "@/lib/master";

// Kembali ke halaman dengan pesan. Pesan dibaca halaman dari alamat (?ok= / ?galat=).
function ke(tab: string, p: { ok?: string; galat?: string; edit?: number }): never {
  const q = new URLSearchParams({ tab });
  if (p.ok) q.set("ok", p.ok);
  if (p.galat) q.set("galat", p.galat);
  if (p.edit) q.set("edit", String(p.edit));
  revalidatePath("/", "layout");
  redirect(`/data-master?${q.toString()}`);
}

const teks = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const angka = (fd: FormData, k: string) => Number(String(fd.get(k) ?? "").trim());

// ---------- Obat ----------
export async function simpanObat(fd: FormData) {
  await wajibLogin(true);
  const id = Number(fd.get("id")) || 0;
  const edit = id || undefined;
  const kode = teks(fd, "kode").toUpperCase();
  const nama = teks(fd, "nama");
  const kategori = teks(fd, "kategori");
  const satuan = teks(fd, "satuan");
  const hargaBeli = angka(fd, "hargaBeli");
  const hargaJual = angka(fd, "hargaJual");
  const minimum = angka(fd, "minimum");

  if (!kode || !nama || !satuan) ke("obat", { galat: "Kode, nama, dan satuan wajib diisi.", edit });
  if (!KATEGORI.includes(kategori)) ke("obat", { galat: "Pilih kategori obat.", edit });
  if (![hargaBeli, hargaJual, minimum].every((n) => Number.isInteger(n) && n >= 0))
    ke("obat", { galat: "Harga dan stok minimum harus berupa angka bulat, tanpa titik atau koma.", edit });
  if (hargaJual <= 0) ke("obat", { galat: "Harga jual harus lebih dari Rp0.", edit });
  if (hargaJual < hargaBeli) ke("obat", { galat: "Harga jual lebih rendah dari harga beli. Periksa kembali angkanya.", edit });

  const sama = await db.obat.findUnique({ where: { kode } });
  if (sama && sama.id !== id) ke("obat", { galat: `Kode ${kode} sudah dipakai obat lain.`, edit });

  const data = { kode, nama, kategori, satuan, hargaBeli, hargaJual, minimum };
  if (id) await db.obat.update({ where: { id }, data });
  else await db.obat.create({ data });
  ke("obat", { ok: id ? `${nama} diperbarui.` : `${nama} ditambahkan.` });
}

export async function hapusObat(fd: FormData) {
  await wajibLogin(true);
  const id = Number(fd.get("id"));
  const o = await db.obat.findUnique({ where: { id }, include: { _count: { select: { batch: true, item: true, itemPembelian: true } } } });
  if (!o) ke("obat", { galat: "Obat tidak ditemukan." });
  if (o._count.batch > 0 || o._count.item > 0 || o._count.itemPembelian > 0)
    ke("obat", { galat: `${o.nama} sudah punya batch atau riwayat transaksi, jadi tidak bisa dihapus.` });
  await db.obat.delete({ where: { id } });
  ke("obat", { ok: `${o.nama} dihapus.` });
}

// ---------- Supplier ----------
export async function simpanSupplier(fd: FormData) {
  await wajibLogin(true);
  const id = Number(fd.get("id")) || 0;
  const edit = id || undefined;
  const nama = teks(fd, "nama");
  if (!nama) ke("supplier", { galat: "Nama supplier wajib diisi.", edit });
  if (nama.length > 120) ke("supplier", { galat: "Nama supplier maksimal 120 karakter.", edit });
  const sama = await db.supplier.findFirst({ where: { nama } });
  if (sama && sama.id !== id) ke("supplier", { galat: `Supplier ${nama} sudah ada.`, edit });
  const data: { nama: string; telepon?: string | null; email?: string | null; alamat?: string | null; catatan?: string | null } = { nama };
  // Field kontak optional: tidak mengosongkan nilai lama ketika form frontend belum menampilkannya.
  if (fd.has("telepon")) data.telepon = teks(fd, "telepon") || null;
  if (fd.has("email")) data.email = teks(fd, "email").toLowerCase() || null;
  if (fd.has("alamat")) data.alamat = teks(fd, "alamat") || null;
  if (fd.has("catatan")) data.catatan = teks(fd, "catatan") || null;
  if (data.telepon && data.telepon.length > 40) ke("supplier", { galat: "Nomor telepon supplier terlalu panjang.", edit });
  if (data.email && !EMAIL.test(data.email)) ke("supplier", { galat: "Format email supplier belum benar.", edit });
  if (id) await db.supplier.update({ where: { id }, data });
  else await db.supplier.create({ data });
  ke("supplier", { ok: id ? `${nama} diperbarui.` : `${nama} ditambahkan.` });
}

export async function hapusSupplier(fd: FormData) {
  await wajibLogin(true);
  const id = Number(fd.get("id"));
  const s = await db.supplier.findUnique({ where: { id }, include: { _count: { select: { batch: true, pembelian: true } } } });
  if (!s) ke("supplier", { galat: "Supplier tidak ditemukan." });
  if (s._count.batch > 0 || s._count.pembelian > 0) ke("supplier", { galat: `${s.nama} masih memiliki ${s._count.batch} batch dan ${s._count.pembelian} riwayat pembelian, jadi tidak bisa dihapus.` });
  await db.supplier.delete({ where: { id } });
  ke("supplier", { ok: `${s.nama} dihapus.` });
}

// ---------- Pengguna ----------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function simpanPengguna(fd: FormData) {
  const sesi = await wajibLogin(true);
  const id = Number(fd.get("id")) || 0;
  const edit = id || undefined;
  const nama = teks(fd, "nama");
  const email = teks(fd, "email").toLowerCase();
  const peran = teks(fd, "peran");
  const sandi = String(fd.get("sandi") ?? "");
  const aktif = id ? fd.get("aktif") === "on" : true;

  if (!nama) ke("pengguna", { galat: "Nama wajib diisi.", edit });
  if (!EMAIL.test(email)) ke("pengguna", { galat: "Format email belum benar.", edit });
  if (!PERAN.includes(peran)) ke("pengguna", { galat: "Pilih peran pengguna.", edit });
  if (!id && sandi.length < SANDI_MIN) ke("pengguna", { galat: `Kata sandi minimal ${SANDI_MIN} karakter.` });

  const sama = await db.pengguna.findUnique({ where: { email } });
  if (sama && sama.id !== id) ke("pengguna", { galat: `Email ${email} sudah terdaftar.`, edit });

  if (id === sesi.id && (peran !== "Admin" || !aktif))
    ke("pengguna", { galat: "Akun yang sedang Anda pakai tidak bisa dinonaktifkan atau diturunkan dari Admin.", edit });

  if (id) {
    const sebelumnya = await db.pengguna.findUnique({ where: { id } });
    if (!sebelumnya) ke("pengguna", { galat: "Pengguna tidak ditemukan.", edit });
    await db.pengguna.update({
      where: { id },
      data: {
        nama, email, peran, aktif,
        ...(sebelumnya.peran !== peran || sebelumnya.aktif !== aktif ? { tokenVersion: { increment: 1 } } : {}),
      },
    });
    ke("pengguna", { ok: `Akun ${nama} diperbarui.` });
  }
  await db.pengguna.create({ data: { nama, email, peran, sandi: await bcrypt.hash(sandi, 10) } });
  ke("pengguna", { ok: `Akun ${nama} dibuat. Sampaikan kata sandinya langsung kepada yang bersangkutan.` });
}

export async function aturUlangSandi(fd: FormData) {
  const sesi = await wajibLogin(true);
  const id = Number(fd.get("id"));
  const sandi = String(fd.get("sandi") ?? "");
  if (sandi.length < SANDI_MIN) ke("pengguna", { galat: `Kata sandi baru minimal ${SANDI_MIN} karakter.`, edit: id });
  const u = await db.pengguna.findUnique({ where: { id } });
  if (!u) ke("pengguna", { galat: "Pengguna tidak ditemukan." });
  const diperbarui = await db.pengguna.update({
    where: { id },
    data: { sandi: await bcrypt.hash(sandi, 10), tokenVersion: { increment: 1 } },
  });
  if (id === sesi.id) {
    // Jika admin mengatur ulang sandinya sendiri, pertahankan sesi perangkat ini saja.
    await buatSesi({ id: diperbarui.id, nama: diperbarui.nama, peran: diperbarui.peran as "Admin" | "Staf", tokenVersion: diperbarui.tokenVersion });
  }
  ke("pengguna", { ok: `Kata sandi ${u.nama} diatur ulang.` });
}
