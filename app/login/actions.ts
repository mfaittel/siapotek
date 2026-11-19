"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buatSesi, hapusSesi, type Peran } from "@/lib/auth";

export async function masuk(fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const sandi = String(fd.get("sandi") || "");
  const u = await db.pengguna.findUnique({ where: { email } });
  if (!u || !u.aktif || !(await bcrypt.compare(sandi, u.sandi))) {
    return { error: "Email atau kata sandi salah." };
  }
  await buatSesi({ id: u.id, nama: u.nama, peran: u.peran as Peran, tokenVersion: u.tokenVersion });
  redirect("/beranda");
}

export async function keluar() {
  hapusSesi();
  redirect("/login");
}
