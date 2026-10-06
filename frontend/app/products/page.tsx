import Link from "next/link";
import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const metadata: Metadata = {
  title: "Pharma Products Directory",
  description: "Search pharmaceutical products and compare verified manufacturers and suppliers across India.",
};
type Item = { key: string; name: string; composition: string | null; dosage_form: string | null; suppliers: number };

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page = "1" } = await searchParams;
  let data: { items: Item[]; total: number; page: number; page_size: number } = { items: [], total: 0, page: 1, page_size: 12 };
  let failed = false;
  try {
    const r = await fetch(`${API}/api/products?q=${encodeURIComponent(q)}&page=${Number(page) || 1}&page_size=24`, { next: { revalidate: 30 } });
    if (!r.ok) throw new Error(); data = await r.json();
  } catch { failed = true; }
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  const link = (p: number) => `/products?q=${encodeURIComponent(q)}&page=${p}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Pharma Products</h1>
      <p className="mt-1 text-sm text-slate-600">Pick a product to see every supplier that offers it and compare them side by side.</p>
      <form className="my-5 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search product, composition or company" className="w-full max-w-md rounded-lg border px-4 py-2.5" />
        <button className="bg-brand-600 rounded-lg px-5 font-semibold text-white">Search</button>
      </form>
      {!failed && <p className="mb-4 text-sm text-slate-600">{data.total} product{data.total === 1 ? "" : "s"}{q && <> matching “{q}”</>}</p>}
      {failed && <p className="rounded-lg bg-red-50 p-4 text-red-700">Could not load products. Please try again.</p>}
      {!failed && data.items.length === 0 && <p className="glass rounded-xl border p-10 text-center text-slate-500">No products found.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map(p => (
          <article key={p.key} className="glass flex flex-col rounded-2xl border p-5 transition-colors hover:border-teal-400">
            <h2 className="font-display font-semibold text-slate-900">{p.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{p.composition ?? "—"}</p>
            <p className="text-sm text-slate-500">{p.dosage_form ?? ""}</p>
            <p className="mt-3 flex-1"><span className="rounded-full bg-teal-600/10 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
              {p.suppliers} supplier{p.suppliers === 1 ? "" : "s"}</span></p>
            <Link href={`/products/compare?name=${encodeURIComponent(p.key)}`}
              className="bg-brand-600 mt-4 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white">
              {p.suppliers > 1 ? "Compare suppliers" : "View supplier"}</Link>
          </article>))}
      </div>
      {pages > 1 && <div className="mt-8 flex items-center justify-center gap-4 text-sm">
        {data.page > 1 && <Link href={link(data.page - 1)}>← Previous</Link>}
        <span>Page {data.page} of {pages}</span>
        {data.page < pages && <Link href={link(data.page + 1)}>Next →</Link>}</div>}
    </div>);
}
