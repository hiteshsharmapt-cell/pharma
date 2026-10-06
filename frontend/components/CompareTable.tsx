"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

export type Supplier = { id: number; slug: string; company_name: string; company_slug: string; business_type: string;
  city: string | null; state: string | null; pack_size: string | null; dosage_form: string | null };

export default function CompareTable({ suppliers, productName }: { suppliers: Supplier[]; productName: string }) {
  const [state, setState] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<"name" | "state">("name");
  const states = useMemo(() => [...new Set(suppliers.map(s => s.state).filter(Boolean) as string[])].sort(), [suppliers]);
  const types = useMemo(() => [...new Set(suppliers.map(s => s.business_type))].sort(), [suppliers]);
  const rows = useMemo(() => suppliers
    .filter(s => (!state || s.state === state) && (!type || s.business_type === type))
    .sort((a, b) => sort === "state" ? (a.state ?? "").localeCompare(b.state ?? "") || a.company_name.localeCompare(b.company_name)
                                     : a.company_name.localeCompare(b.company_name)), [suppliers, state, type, sort]);
  const sel = "rounded-lg border bg-white/80 px-3 py-2 text-sm";
  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={state} onChange={e => setState(e.target.value)} className={sel} aria-label="Filter by state">
          <option value="">All states</option>{states.map(s => <option key={s}>{s}</option>)}</select>
        <select value={type} onChange={e => setType(e.target.value)} className={sel} aria-label="Filter by business type">
          <option value="">All business types</option>{types.map(s => <option key={s}>{s}</option>)}</select>
        <select value={sort} onChange={e => setSort(e.target.value as "name" | "state")} className={sel} aria-label="Sort">
          <option value="name">Sort: Company A–Z</option><option value="state">Sort: State</option></select>
        <span className="ml-auto text-sm text-slate-600">Showing {rows.length} of {suppliers.length}</span>
      </div>
      {rows.length === 0 ? <p className="glass rounded-xl border p-8 text-center text-slate-500">No suppliers match these filters.</p> : (
        <div className="glass overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-slate-600">
              <tr><th className="p-3">Company</th><th className="p-3">Location</th><th className="p-3">Business type</th>
                <th className="p-3">Pack size</th><th className="p-3">Form</th><th className="p-3 text-right">Action</th></tr></thead>
            <tbody>{rows.map(s => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-white/50">
                <td className="p-3 font-semibold text-slate-900"><Link href={`/companies/${s.company_slug}`} className="hover:text-teal-700">{s.company_name}</Link></td>
                <td className="p-3">{[s.city, s.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="p-3">{s.business_type}</td>
                <td className="p-3">{s.pack_size ?? "—"}</td>
                <td className="p-3">{s.dosage_form ?? "—"}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Link href={`/companies/${s.company_slug}`} className="mr-2 rounded-lg border border-teal-700/30 px-3 py-1.5 font-semibold text-teal-800 hover:bg-teal-50">Company</Link>
                  <Link href={`/post-requirement?product=${encodeURIComponent(productName)}`} className="bg-brand-600 rounded-lg px-3 py-1.5 font-semibold text-white">Enquire</Link>
                </td></tr>))}
            </tbody>
          </table>
        </div>)}
    </section>);
}
