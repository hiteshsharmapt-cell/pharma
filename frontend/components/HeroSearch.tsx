"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const TABS = [
  { key: "companies", label: "Companies", hint: "Search company name or business" },
  { key: "products", label: "Products", hint: "Search product, composition or company" },
] as const;

export default function HeroSearch() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("companies");
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); router.push(`/${tab}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); };
  return (
    <form onSubmit={submit} className="glass-strong w-full max-w-2xl rounded-2xl p-2">
      <div className="flex gap-1 px-2 pt-1 text-sm font-semibold" role="tablist">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 transition ${tab === t.key ? "bg-teal-600 text-white" : "text-slate-600 hover:text-teal-700"}`}>{t.label}</button>))}
      </div>
      <div className="flex gap-2 p-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={TABS.find(t => t.key === tab)!.hint}
          aria-label="Search" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base" />
        <button className="bg-brand-600 rounded-xl px-6 font-semibold text-white">Search</button>
      </div>
    </form>);
}
