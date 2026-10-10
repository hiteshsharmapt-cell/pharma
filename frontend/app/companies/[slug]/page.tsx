import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
type Company = { name: string; slug: string; description: string | null; business_type: string; city: string | null;
  state: string | null; address: string | null; brochure_url: string | null; categories: string[]; specialities?: string[]; capabilities?: { category: string; dosage_form_group: string; formulation_types: string[] }[];
  products: { name: string; slug: string; composition: string | null; dosage_form: string | null; pack_size: string | null }[] };

type Result = { company: Company | null; notFound: boolean; error: string | null };

async function load(slug: string): Promise<Result> {
  try {
    const r = await fetch(`${API}/api/companies/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (r.status === 404) return { company: null, notFound: true, error: null };
    if (!r.ok) return { company: null, notFound: false, error: `Backend returned ${r.status}` };
    return { company: await r.json(), notFound: false, error: null };
  } catch (e: any) {
    return { company: null, notFound: false, error: `Could not reach the backend at ${API} (${e?.cause?.code ?? e?.message ?? "network error"})` };
  }
}

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { company: c } = await load((await params).slug);
  if (!c) return { title: "Company" };
  return { title: c.name, description: c.description?.slice(0, 155) ?? `${c.name} — ${c.business_type} in ${c.city ?? "India"}`,
           alternates: { canonical: `/companies/${c.slug}` } };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { company: c, notFound: missing, error } = await load(slug);
  if (missing) notFound();
  if (!c) return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-xl font-bold">Could not load this company</h1>
      <p className="mt-2 text-sm text-red-700">{error}</p>
      <p className="mt-2 text-sm text-slate-500">Make sure the backend is running, then reload.</p>
      <Link href="/companies" className="mt-5 inline-block rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white">Back to companies</Link>
    </div>);
  const where = [c.city, c.state].filter(Boolean).join(", ");
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="mb-4 text-sm text-slate-500"><Link href="/">Home</Link> / <Link href="/companies">Companies</Link> / {c.name}</nav>
      <header className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-100 text-2xl font-bold text-brand-700">{c.name[0]}</div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{c.name} <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 align-middle text-xs text-emerald-800">Approved</span></h1>
          <p className="text-slate-500">{where} · {c.business_type}</p>
        </div>
        <Link href="/post-requirement" className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white">Enquire Now</Link>
      </header>
      <section className="mt-6 rounded-xl border bg-white p-6"><h2 className="mb-2 font-semibold">About</h2>
        <p className="text-sm">{c.description ?? "This company has not added a description yet."}</p></section>
      <section className="mt-6 rounded-xl border bg-white p-6"><h2 className="mb-2 font-semibold">Business information</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Business type</dt><dd>{c.business_type}</dd></div>
          <div><dt className="text-slate-500">Location</dt><dd>{where || "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Address</dt><dd>{c.address ?? "—"}</dd></div>
        </dl>
        {c.brochure_url && <a href={c.brochure_url} className="mt-3 inline-block text-sm font-semibold text-brand-600">Download brochure</a>}
      </section>
      {c.categories.length > 0 && <section className="mt-6 flex flex-wrap gap-2">
        {c.categories.map(x => <span key={x} className="rounded-full border bg-white px-3 py-1 text-sm">{x}</span>)}</section>}
      {((c.specialities?.length ?? 0) > 0 || (c.capabilities?.length ?? 0) > 0) && (
        <section className="mt-6 rounded-xl border bg-white p-6"><h2 className="mb-1 font-semibold">Verified capabilities</h2>
          <p className="mb-3 text-xs text-slate-500">Confirmed by PharmaConnect.</p>
          {(c.specialities?.length ?? 0) > 0 && <div className="mb-4"><h3 className="mb-1.5 text-sm text-slate-500">Specialities</h3>
            <div className="flex flex-wrap gap-2">{c.specialities!.map(x => <span key={x} className="rounded-full bg-teal-600/10 px-3 py-1 text-sm font-medium text-teal-800">{x}</span>)}</div></div>}
          {(c.capabilities?.length ?? 0) > 0 && <div><h3 className="mb-1.5 text-sm text-slate-500">Manufacturing</h3>
            <ul className="grid gap-2 sm:grid-cols-2">{c.capabilities!.map(x => (
              <li key={x.category} className="rounded-lg border p-3 text-sm"><span className="font-semibold">{x.category}</span>
                <span className="text-slate-500"> · {x.dosage_form_group}</span>
                {x.formulation_types.length > 0 && <div className="mt-0.5 text-xs text-slate-600">{x.formulation_types.join(", ")}</div>}</li>))}</ul></div>}
        </section>)}
      <section className="mt-6"><h2 className="mb-3 font-semibold">Products</h2>
        {c.products.length === 0 ? <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">No products listed yet.</p> :
          <div className="grid gap-3 sm:grid-cols-2">{c.products.map(p => (
            <Link key={p.slug} href={`/products/${p.slug}`} className="rounded-xl border bg-white p-4 hover:border-brand-600"><div className="font-semibold">{p.name}</div>
              <div className="text-sm text-slate-500">{[p.composition, p.dosage_form, p.pack_size].filter(Boolean).join(" · ")}</div></Link>))}</div>}
      </section>
    </div>);
}
