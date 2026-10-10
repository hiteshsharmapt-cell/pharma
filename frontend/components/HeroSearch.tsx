"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TABS = [
  { key: "companies", label: "Companies", hint: "Search company name or business" },
  { key: "products", label: "Products", hint: "Search product, composition or company" },
  { key: "speciality", label: "By Speciality", hint: "" },
  { key: "category", label: "By Product Category", hint: "" },
] as const;
type Tab = (typeof TABS)[number]["key"];
type Simple = { id: number; name: string };
type Cat = Simple & { dosage_form_group_id: number; dosage_form_group: string };

export default function HeroSearch() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("companies");
  const [q, setQ] = useState("");
  const [specs, setSpecs] = useState<Simple[] | null>(null);
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [spec, setSpec] = useState(""); const [cat, setCat] = useState("");

  // The speciality / category lists are only fetched when their tab is opened.
  useEffect(() => {
    const need = tab === "speciality" ? "/api/catalog/specialities" : tab === "category" ? "/api/catalog/product-categories" : "";
    if (!need || (tab === "speciality" ? specs : cats)) return;
    setLoadFailed(false);
    fetch(`${API}${need}`).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => (tab === "speciality" ? setSpecs(d) : setCats(d))).catch(() => setLoadFailed(true));
  }, [tab, specs, cats]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tab === "speciality") return router.push(`/find?tab=speciality${spec ? `&speciality=${spec}` : ""}`);
    if (tab === "category") {
      const c = cats?.find(x => String(x.id) === cat);
      return router.push(`/find?tab=category${c ? `&group=${c.dosage_form_group_id}&category=${c.id}` : ""}`);
    }
    router.push(`/${tab}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  const groups = cats ? [...new Set(cats.map(c => c.dosage_form_group))] : [];
  const sel = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base";
  return (
    <form onSubmit={submit} className="glass-strong w-full max-w-2xl rounded-2xl p-2">
      <div className="flex flex-wrap gap-1 px-2 pt-1 text-sm font-semibold" role="tablist">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 transition ${tab === t.key ? "bg-teal-600 text-white" : "text-slate-600 hover:text-teal-700"}`}>{t.label}</button>))}
      </div>
      <div className="flex gap-2 p-2">
        {tab === "speciality" ? (
          <select value={spec} onChange={e => setSpec(e.target.value)} aria-label="Speciality" className={sel}>
            <option value="">{specs ? "Select a speciality" : loadFailed ? "Could not load specialities" : "Loading specialities…"}</option>
            {specs?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        ) : tab === "category" ? (
          <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Product category" className={sel}>
            <option value="">{cats ? "Select a product category" : loadFailed ? "Could not load categories" : "Loading categories…"}</option>
            {groups.map(g => <optgroup key={g} label={g}>{cats!.filter(c => c.dosage_form_group === g).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select>
        ) : (
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={TABS.find(t => t.key === tab)!.hint}
            aria-label="Search" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base" />
        )}
        <button className="bg-brand-600 rounded-xl px-6 font-semibold text-white">Search</button>
      </div>
      {(tab === "speciality" || tab === "category") && (
        <p className="px-3 pb-2 text-xs text-slate-600">Opens the full search, where you can add dosage form, formulation type and location filters.</p>)}
    </form>);
}
