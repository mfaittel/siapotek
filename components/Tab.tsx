export default function Tab({ tabs, aktif, dasar }: { tabs: { k: string; label: string }[]; aktif: string; dasar: string }) {
  return (
    <div className="flex gap-6 border-b border-bingkai mb-5">
      {tabs.map((t) => (
        <a
          key={t.k}
          href={`${dasar}?tab=${encodeURIComponent(t.k)}`}
          aria-current={aktif === t.k ? "page" : undefined}
          className={`pb-3 -mb-px text-[13px] font-semibold border-b-2 ${aktif === t.k ? "border-utama text-utama" : "border-transparent text-slate-500"}`}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}
