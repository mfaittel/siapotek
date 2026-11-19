export default function Lencana({ label, kelas }: { label: string; kelas: string }) {
  return <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${kelas}`}>{label}</span>;
}
