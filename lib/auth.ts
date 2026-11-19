import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export type Peran = "Admin" | "Staf";
export type Sesi = { id: number; nama: string; peran: Peran; tokenVersion: number };
const NAMA_COOKIE = "sesi";
const MASA_SESI_DETIK = 8 * 60 * 60;

function kunciSesi() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SESSION_SECRET belum diatur atau kurang dari 32 byte. Isi .env sebelum menjalankan aplikasi.");
  }
  return new TextEncoder().encode(secret);
}

export async function buatSesi(data: Sesi) {
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${MASA_SESI_DETIK}s`)
    .sign(kunciSesi());

  (await cookies()).set(NAMA_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MASA_SESI_DETIK,
  });
}

export async function hapusSesi() {
  (await cookies()).delete(NAMA_COOKIE);
}

export async function ambilSesi(): Promise<Sesi | null> {
  const token = (await cookies()).get(NAMA_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, kunciSesi(), { algorithms: ["HS256"] });
    const valid =
      Number.isSafeInteger(payload.id) &&
      typeof payload.nama === "string" &&
      (payload.peran === "Admin" || payload.peran === "Staf") &&
      Number.isSafeInteger(payload.tokenVersion);
    if (!valid) return null;
    return {
      id: Number(payload.id),
      nama: String(payload.nama),
      peran: payload.peran as Peran,
      tokenVersion: Number(payload.tokenVersion),
    };
  } catch {
    return null;
  }
}

/** Validasi sesi dan status akun dilakukan ulang pada setiap halaman/Server Action. */
export async function wajibLogin(adminSaja = false): Promise<Sesi> {
  const tokenSesi = await ambilSesi();
  if (!tokenSesi) redirect("/login");

  const pengguna = await db.pengguna.findUnique({ where: { id: tokenSesi.id } });
  if (
    !pengguna ||
    !pengguna.aktif ||
    pengguna.tokenVersion !== tokenSesi.tokenVersion ||
    (pengguna.peran !== "Admin" && pengguna.peran !== "Staf")
  ) {
    redirect("/login");
  }

  const sesi: Sesi = {
    id: pengguna.id,
    nama: pengguna.nama,
    peran: pengguna.peran as Peran,
    tokenVersion: pengguna.tokenVersion,
  };

  if (adminSaja && sesi.peran !== "Admin") redirect("/beranda");
  return sesi;
}
