"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buatSesi, wajibLogin } from "@/lib/auth";
import { SANDI_MIN } from "@/lib/master";

function ke(tab: string, p: { ok?: string; galat?: string }): never {
  const q = new URLSearchParams({ tab });
  if (p.ok) q.set("ok", p.ok);
  if (p.galat) q.set("galat", p.galat);
  revalidatePath("/", "layout");
  redirect(`/pengaturan?${q.toString()}`);
}

const teks = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function simpanApotek(fd: FormData) {
  await wajibLogin(true);
  const namaApotek = teks(fd, "namaApotek");
  const cabang = teks(fd, "cabang");
  const buka = teks(fd, "buka");
  const tutup = teks(fd, "tutup");
  if (!namaApotek || !cabang) ke("apotek", { galat: "Nama apotek dan cabang wajib diisi." });
  if (namaApotek.length > 60 || cabang.length > 40) ke("apotek", { galat: "Nama apotek maksimal 60 karakter dan cabang maksimal 40 karakter." });
  if (!JAM.test(buka) || !JAM.test(tutup)) ke("apotek", { galat: "Jam buka dan jam tutup belum benar." });
  if (buka === tutup) ke("apotek", { galat: "Jam buka dan jam tutup tidak boleh sama." });

  const isi = { namaApotek, cabang, buka, tutup };
  await db.$transaction(
    Object.entries(isi).map(([kunci, nilai]) =>
      db.pengaturan.upsert({ where: { kunci }, update: { nilai }, create: { kunci, nilai } })
    )
  );
  ke("apotek", { ok: "Profil apotek disimpan." });
}

export async function gantiNama(fd: FormData) {
  const s = await wajibLogin(true);
  const nama = teks(fd, "nama");
  if (!nama) ke("akun", { galat: "Nama tidak boleh kosong." });
  await db.pengguna.update({ where: { id: s.id }, data: { nama } });
  ke("akun", { ok: "Nama diperbarui." });
}

export async function gantiSandi(fd: FormData) {
  const s = await wajibLogin(true);
  const lama = String(fd.get("lama") ?? "");
  const baru = String(fd.get("baru") ?? "");
  const ulang = String(fd.get("ulang") ?? "");
  const u = await db.pengguna.findUnique({ where: { id: s.id } });
  if (!u || !(await bcrypt.compare(lama, u.sandi))) ke("akun", { galat: "Kata sandi saat ini salah." });
  if (baru.length < SANDI_MIN) ke("akun", { galat: `Kata sandi baru minimal ${SANDI_MIN} karakter.` });
  if (baru !== ulang) ke("akun", { galat: "Pengulangan kata sandi baru tidak sama." });
  if (baru === lama) ke("akun", { galat: "Kata sandi baru harus berbeda dari yang lama." });
  const diperbarui = await db.pengguna.update({
    where: { id: s.id },
    data: { sandi: await bcrypt.hash(baru, 10), tokenVersion: { increment: 1 } },
  });
  // Perbarui token sesi yang sedang digunakan; sesi pada perangkat lain otomatis tidak berlaku.
  await buatSesi({ id: diperbarui.id, nama: diperbarui.nama, peran: diperbarui.peran as "Admin" | "Staf", tokenVersion: diperbarui.tokenVersion });
  ke("akun", { ok: "Kata sandi diganti." });
}
