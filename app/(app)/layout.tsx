import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { menuUntuk } from "@/lib/nav";
import { wajibLogin } from "@/lib/auth";
import { ringkasan } from "@/lib/data";
import { ambilPengaturan } from "@/lib/pengaturan";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await wajibLogin();
  const [r, apotek] = await Promise.all([ringkasan(), ambilPengaturan()]);
  const menu = menuUntuk(s.peran).map((m) => (m.href === "/peringatan" ? { ...m, badge: r.perhatian } : m));
  return (
    <div className="flex min-h-screen">
      <Sidebar menu={menu} peran={s.peran} apotek={apotek.namaApotek} cabang={apotek.cabang} />
      <div className="flex-1 min-w-0">
        <Topbar nama={s.nama} peran={s.peran} apotek={apotek} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
