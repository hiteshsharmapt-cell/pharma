import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CompareTable, { type Supplier } from "@/components/CompareTable";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
type Data = { name: string; composition: string | null; dosage_form: string | null; suppliers: Supplier[] };

async function load(name: string): Promise<{ data: Data | null; missing: boolean }> {
  try {
    const r = await fetch(`${API}/api/products/compare?name=${encodeURIComponent(name)}`, { next: { revalidate: 60 } });
    if (r.status === 404) return { data: null, missing: true };
    if (!r.ok) return { data: null, missing: false };
    return { data: await r.json(), missing: false };
  } catch { return { data: null, missing: false }; }
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ name?: string }> }): Promise<Metadata> {
  const { data } = await load((await searchParams).name ?? "");
  return { title: data ? `${data.name} – compare suppliers` : "Compare suppliers" };
}

export default async function Compare({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name = "" } = await searchParams;
  if (!name) notFound();
  const { data, missing } = await load(name);
  if (missing) notFound();
  if (!data) return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-xl font-bold">Could not load this product</h1>
      <p className="mt-2 text-sm text-slate-500">Make sure the backend is running, then reload.</p>
      <Link href="/products" className="bg-brand-600 mt-5 inline-block rounded-lg px-5 py-2.5 font-semibold text-white">Back to products</Link>
    </div>);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-4 text-sm text-slate-600"><Link href="/">Home</Link> / <Link href="/products">Products</Link> / {data.name}</nav>
      <header className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">{data.name}</h1>
          <p className="mt-1 text-sm text-slate-600">{[data.composition, data.dosage_form].filter(Boolean).join(" · ")}</p>
          <p className="mt-2 text-sm font-semibold text-teal-800">{data.suppliers.length} supplier{data.suppliers.length === 1 ? "" : "s"} offer this product</p>
        </div>
        <Link href="/post-requirement" className="bg-brand-600 rounded-lg px-5 py-2.5 font-semibold text-white">Post a requirement</Link>
      </header>
      <CompareTable suppliers={data.suppliers} productName={data.name} />
    </div>);
}
