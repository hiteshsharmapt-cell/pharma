import Link from "next/link";
import { cdn } from "@/lib/img";

export type CompanyCardData = { id: number; name: string; slug: string; description: string | null; logo_url?: string | null; business_type: string;
  city: string | null; state: string | null; categories: string[]; featured_rank?: number | null; specialities?: string[] };

export default function CompanyCard({ c }: { c: CompanyCardData }) {
  const where = [c.city, c.state].filter(Boolean).join(", ");
  const top = c.featured_rank != null && c.featured_rank <= 5;  // admin-controlled "Top 5" highlight
  return (
    <article className={`glass relative flex flex-col rounded-2xl border p-5 transition-colors ${top
      ? "border-amber-400 shadow-lg shadow-amber-300/30 ring-2 ring-amber-300/70" : "hover:border-teal-400"}`}>
      {top && <span className="absolute -top-3 right-4 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1 text-xs font-bold text-amber-950 shadow">★ Top {c.featured_rank}</span>}
      <div className="mb-3 flex items-center gap-3">
        {c.logo_url
          ? <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1"><img src={cdn(c.logo_url, 120)} alt={`${c.name} logo`} loading="lazy" className="h-full w-full object-contain" /></div>
          : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 font-display text-lg font-semibold text-white">{c.name[0]}</div>}
        <div className="min-w-0">
          <h2 className="truncate font-display font-semibold text-slate-900">{c.name}</h2>
          <p className="truncate text-sm text-slate-500">{where || "India"}</p>
        </div>
      </div>
      <span className="mb-2 w-fit rounded-full border border-slate-200 bg-white/70 px-2.5 py-0.5 text-xs text-slate-600">{c.business_type}</span>
      <p className="line-clamp-3 flex-1 text-sm text-slate-600">{c.description ?? "No description added yet."}</p>
      {(c.specialities?.length ? c.specialities : c.categories).length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{(c.specialities?.length ? c.specialities : c.categories).slice(0, 3).map(x =>
        <span key={x} className="rounded-full bg-teal-600/10 px-2 py-0.5 text-xs font-medium text-teal-800">{x}</span>)}</div>}
      <div className="mt-4 flex gap-2">
        <Link href={`/companies/${c.slug}`} className="bg-brand-600 rounded-lg px-4 py-2 text-sm font-semibold text-white">View Company</Link>
        <Link href="/post-requirement" className="rounded-lg border border-teal-700/30 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50">Enquire</Link>
      </div>
    </article>);
}
