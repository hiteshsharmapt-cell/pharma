import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
type Card = { name: string; slug: string; composition: string | null; dosage_form: string | null; pack_size: string | null;
  company_name: string; company_slug: string; city: string | null; state: string | null };
type Product = Card & { description: string | null; related: Card[] };
type Result = { product: Product | null; missing: boolean; error: string | null };

async function load(slug: string): Promise<Result> {
  try {
    const r = await fetch(`${API}/api/products/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (r.status === 404) return { product: null, missing: true, error: null };
    if (!r.ok) return { product: null, missing: false, error: `Backend returned ${r.status}` };
    return { product: await r.json(), missing: false, error: null };
  } catch (e: any) { return { product: null, missing: false, error: `Could not reach the backend at ${API}` }; }
}

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { product: p } = await load((await params).slug);
  if (!p) return { title: "Product" };
  return { title: `${p.name} by ${p.company_name}`, description: p.description?.slice(0, 155) ?? `${p.name} — ${p.composition ?? ""} from ${p.company_name}`,
           alternates: { canonical: `/products/${p.slug}` } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { product: p, missing, error } = await load((await params).slug);
  if (missing) notFound();
  if (!p) return (<div className="mx-auto max-w-xl px-4 py-20 text-center">
    <h1 className="text-xl font-bold">Could not load this product</h1><p className="mt-2 text-sm text-red-700">{error}</p>
    <Link href="/products" className="mt-5 inline-block rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white">Back to products</Link></div>);
  const where = [p.city, p.state].filter(Boolean).join(", ");
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="mb-4 text-sm text-slate-500"><Link href="/">Home</Link> / <Link href="/products">Products</Link> / {p.name}</nav>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-white p-6">
        <div><h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="mt-1 text-slate-600">{p.composition ?? ""}</p></div>
        <div className="flex gap-2"><Link href={`/products/compare?name=${encodeURIComponent(p.name.trim().toLowerCase())}`} className="rounded-lg border border-teal-700/30 px-5 py-2.5 font-semibold text-teal-800">Compare suppliers</Link>
        <Link href="/post-requirement" className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white">Enquire Now</Link></div>
      </header>
      <section className="mt-6 rounded-xl border bg-white p-6"><dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">Dosage form</dt><dd>{p.dosage_form ?? "—"}</dd></div>
        <div><dt className="text-slate-500">Pack size</dt><dd>{p.pack_size ?? "—"}</dd></div>
        <div><dt className="text-slate-500">Supplier</dt><dd><Link href={`/companies/${p.company_slug}`} className="font-semibold text-brand-600">{p.company_name}</Link>{where && <span className="text-slate-500"> · {where}</span>}</dd></div>
      </dl></section>
      {p.description && <section className="mt-6 rounded-xl border bg-white p-6"><h2 className="mb-2 font-semibold">Description</h2><p className="whitespace-pre-wrap text-sm">{p.description}</p></section>}
      {p.related.length > 0 && <section className="mt-6"><h2 className="mb-3 font-semibold">More from {p.company_name}</h2>
        <div className="grid gap-3 sm:grid-cols-2">{p.related.map(r => (
          <Link key={r.slug} href={`/products/${r.slug}`} className="rounded-xl border bg-white p-4"><div className="font-semibold">{r.name}</div>
            <div className="text-sm text-slate-500">{[r.composition, r.dosage_form, r.pack_size].filter(Boolean).join(" · ")}</div></Link>))}</div></section>}
    </div>);
}
