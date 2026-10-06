import Link from "next/link";
import type { Metadata } from "next";
import CompanyCard, { type CompanyCardData } from "@/components/CompanyCard";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const metadata: Metadata = {
  title: "Pharma Companies Directory",
  description: "Browse verified pharmaceutical manufacturers, PCD franchise companies and suppliers across India.",
};
const TYPES = ["Manufacturer", "Third Party Manufacturer", "PCD Franchise Company", "Distributor", "Wholesaler"];
type SP = { q?: string; page?: string; state_id?: string; city_id?: string; business_type?: string };
type Loc = { id: number; name: string; type: "STATE" | "CITY" };

export default async function Companies({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { q = "", state_id = "", city_id = "", business_type = "" } = sp;
  const page = Number(sp.page) || 1;
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  if (state_id) params.set("state_id", state_id);
  if (city_id) params.set("city_id", city_id);
  if (business_type) params.set("business_type", business_type);

  let data: { items: CompanyCardData[]; total: number; page: number; page_size: number } = { items: [], total: 0, page: 1, page_size: 12 };
  let locs: Loc[] = []; let failed = false;
  try {
    const [r, l] = await Promise.all([fetch(`${API}/api/companies?${params}`, { cache: "no-store" }), fetch(`${API}/api/locations`, { cache: "no-store" })]);
    if (!r.ok) throw new Error();
    data = await r.json(); locs = l.ok ? await l.json() : [];
  } catch { failed = true; }

  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  const link = (p: number) => { const n = new URLSearchParams(params); n.set("page", String(p)); return `/companies?${n}`; };
  const sel = "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold text-white">Pharma Companies</h1>
      <p className="mt-1 text-slate-400">{failed ? "" : `${data.total} verified ${data.total === 1 ? "company" : "companies"}`}</p>
      <form className="glass mt-6 grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input name="q" defaultValue={q} placeholder="Search companies" aria-label="Search" className={`${sel} lg:col-span-2`} />
        <select name="state_id" defaultValue={state_id} aria-label="State" className={sel}>
          <option value="">All states</option>{locs.filter(l => l.type === "STATE").map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <select name="city_id" defaultValue={city_id} aria-label="City" className={sel}>
          <option value="">All cities</option>{locs.filter(l => l.type === "CITY").map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <select name="business_type" defaultValue={business_type} aria-label="Company type" className={sel}>
          <option value="">All types</option>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button className="bg-brand-600 rounded-xl px-6 py-2.5 text-sm font-semibold text-white">Search</button>
          <Link href="/companies" className="rounded-xl border border-teal-700/30 px-5 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50">Clear</Link>
        </div>
      </form>

      {failed && <p className="mt-6 rounded-xl border border-red-300/30 bg-red-500/10 p-4 text-red-200">Could not load companies. Please try again.</p>}
      {!failed && data.items.length === 0 && <p className="glass mt-6 rounded-2xl border p-10 text-center text-slate-300">No companies found. Try changing your filters.</p>}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.items.map(c => <CompanyCard key={c.id} c={c} />)}</div>
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4 text-sm">
          {data.page > 1 && <Link href={link(data.page - 1)} className="glass rounded-full border px-4 py-2">← Previous</Link>}
          <span className="text-slate-300">Page {data.page} of {pages}</span>
          {data.page < pages && <Link href={link(data.page + 1)} className="glass rounded-full border px-4 py-2">Next →</Link>}
        </nav>)}
    </div>);
}
