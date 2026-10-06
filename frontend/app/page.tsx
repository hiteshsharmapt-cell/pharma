import Link from "next/link";
import HeroSearch from "@/components/HeroSearch";
import CompanyCard, { type CompanyCardData } from "@/components/CompanyCard";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
async function get<T>(path: string, fallback: T): Promise<T> {
  try { const r = await fetch(`${API}${path}`, { next: { revalidate: 60 } }); return r.ok ? ((await r.json()) as T) : fallback; }
  catch { return fallback; }
}
type Cat = { id: number; name: string; slug: string; parent_id: number | null };
type Loc = { id: number; name: string; type: "STATE" | "CITY" };

const STEPS = [
  ["Search", "Browse verified companies and products, filtered by what you need."],
  ["Find a supplier", "Compare profiles, product ranges and locations."],
  ["Post a requirement", "Describe what you need once, in a minute."],
  ["Get connected", "Our team matches you with suitable suppliers."],
];

export default async function Home() {
  const [cats, companies, products, locs, featured] = await Promise.all([
    get<Cat[]>("/api/categories", []),
    get<{ items: CompanyCardData[]; total: number }>("/api/companies?page_size=6", { items: [], total: 0 }),
    get<{ total: number }>("/api/products?page_size=1", { total: 0 }),
    get<Loc[]>("/api/locations", []),
    get<{ items: CompanyCardData[] }>("/api/companies/featured", { items: [] }),
  ]);
  // Admin picks the featured list (Admin > Featured). Until one is chosen, fall back to the latest companies.
  const featuredList = featured.items.length > 0 ? featured.items : companies.items;
  const cities = locs.filter(l => l.type === "CITY").slice(0, 12);

  return (<>
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24">
      <div className="hero-in max-w-2xl">
        <p className="inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-teal-100 backdrop-blur">India&apos;s B2B marketplace for pharma buyers and suppliers</p>
        <h1 className="headline mt-6 font-display text-4xl font-semibold leading-tight sm:text-6xl">Find Pharmaceutical Companies, Products &amp; Business Opportunities</h1>
        <p className="mt-5 max-w-xl text-lg text-slate-300">PharmaConnect links pharmaceutical buyers with verified manufacturers, PCD franchise companies and suppliers, so the right partner is one search away.</p>
        <div className="space-y-5">
          <HeroSearch />
          <div className="flex flex-wrap gap-3">
            <Link href="/post-requirement" className="bg-brand-600 rounded-full px-7 py-3 font-semibold text-white">Post Your Requirement</Link>
            <Link href="/companies" className="glass rounded-full border px-7 py-3 font-semibold text-teal-800">Browse Companies</Link>
          </div>
        </div>
      </div>
      {(companies.total > 0 || products.total > 0) && (
        <div className="glass mt-12 flex w-fit flex-wrap gap-x-10 gap-y-3 rounded-2xl border px-6 py-4">
          <div><div className="font-display text-2xl font-semibold text-slate-900">{companies.total}</div><div className="text-sm text-slate-500">Verified companies</div></div>
          <div><div className="font-display text-2xl font-semibold text-slate-900">{products.total}</div><div className="text-sm text-slate-500">Listed products</div></div>
        </div>)}
    </section>

    {cats.length > 0 && (
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-semibold text-white">Browse by category</h2>
        <p className="mt-1 text-slate-400">Tell us the category you need and we&apos;ll find suppliers for it.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {cats.map(c => (
            <Link key={c.id} href={`/post-requirement?category=${c.id}`}
              className="glass rounded-full border px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-teal-500 hover:text-teal-800">{c.name}</Link>))}
        </div>
      </section>)}

    {featuredList.length > 0 && (
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold text-white">Featured companies</h2>
          <Link href="/companies" className="text-sm font-semibold text-teal-300 hover:text-teal-200">View all</Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{featuredList.map(c => <CompanyCard key={c.id} c={c} />)}</div>
      </section>)}

    {cities.length > 0 && (
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display text-2xl font-semibold text-white">Popular locations</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {cities.map(l => (
            <Link key={l.id} href={`/companies?city_id=${l.id}`}
              className="glass rounded-xl border px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-teal-500 hover:text-teal-800">{l.name}</Link>))}
        </div>
      </section>)}

    <section className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="font-display text-2xl font-semibold text-white">How it works</h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-4">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="glass relative rounded-2xl border p-6">
            <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-300 to-cyan-500 font-display font-semibold text-[#06141c]">{i + 1}</span>
            <h3 className="font-display font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </li>))}
      </ol>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="glass-strong rounded-3xl px-6 py-14 text-center">
        <h2 className="mx-auto max-w-xl font-display text-3xl font-semibold text-slate-900">Looking for a reliable pharma partner?</h2>
        <p className="mx-auto mt-3 max-w-lg text-slate-600">Post your requirement and we&apos;ll connect you with suppliers who fit.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/post-requirement" className="bg-brand-600 rounded-full px-8 py-3 font-semibold text-white">Post Your Requirement</Link>
          <Link href="/register" className="rounded-full border border-teal-700/30 px-8 py-3 font-semibold text-teal-800 hover:bg-teal-50">List your company</Link>
        </div>
      </div>
    </section>
  </>);
}
