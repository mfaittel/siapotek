"use client";
import { useState } from "react";
import { Mail, EyeOff, KeyRound, ArrowRight, Info } from "lucide-react";
import { masuk } from "./actions";

export default function Login() {
  const [error, setError] = useState("");
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form className="w-full max-w-[440px]"
        action={async (fd) => { const r = await masuk(fd); if (r?.error) setError(r.error); }}>
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-lembut text-utama"><KeyRound size={24} /></div>
        <h1 className="mt-5 text-[32px] font-extrabold">Selamat datang kembali</h1>
        <p className="mt-2 text-slate-500">Masuk ke SIAPOTEK untuk memulai pelayanan di Apotek Sehat Sentosa.</p>

        <label className="block mt-8 font-semibold" htmlFor="email">Email</label>
        <div className="relative mt-2">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input id="email" name="email" type="email" required placeholder="nama@sehatsentosa.id" className="input pl-10" />
        </div>

        <label className="block mt-5 font-semibold" htmlFor="sandi">Kata sandi</label>
        <div className="relative mt-2">
          <EyeOff size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input id="sandi" name="sandi" type="password" required placeholder="Masukkan kata sandi" className="input pl-10" />
        </div>

        {error && <p className="mt-3 text-[12px] text-error border border-error rounded-kontrol px-3 py-2">{error}</p>}

        <button className="btn-utama w-full mt-5"><ArrowRight size={16} />Masuk ke SIAPOTEK</button>
        <div className="mt-6 flex gap-3 p-4 rounded-kontrol bg-slate-100 text-[13px] text-slate-600">
          <Info size={16} className="shrink-0 mt-0.5" />
          Belum memiliki akun? Hubungi Admin apotek untuk mendapatkan akses.
        </div>
      </form>
    </main>
  );
}
