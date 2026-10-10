"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import CompanyCard, { type CompanyCardData } from "@/components/CompanyCard";
import SearchableSelect, { type Opt } from "@/components/SearchableSelect";

type Simple = { id: number; name: string };
type Cat = Simple & { dosage_form_group_id: number; dosage_form_group: string; parent_id: number | null };
type Loc = { id: number; name: string; type: "STATE" | "CITY"; parent_id: number | null };
type Result = { items: (CompanyCardData & { specialities?: string[] })[]; total: number; page: number; page_size: number };
type Tab = "speciality" | "category";
const PAGE_SIZE = 12;

const num = (v: string | null): number | "" => (v && /^\d+$/.test(v) ? Number(v) : "");

export default function FindSearch() {
  const router = useRouter(); const sp = useSearchParams();
  const tab: Tab = sp.get("tab") === "category" ? "category" : "speciality";
  // The URL is the source of truth for the *applied* search, so results are shareable and survive a reload.
  const applied = useMemo(() => ({
    speciality: num(sp.get("speciality")), group: num(sp.get("group")), category: num(sp.get("category")),
    formulation: num(sp.get("formulation")), state: num(sp.get("state")), city: num(sp.get("city")),
    unverified: sp.get("unverified") === "1", page: Math.max(1, Number(sp.get("page")) || 1),
  }), [sp]);
  const [draft, setDraft] = useState(applied);
  useEffect(() => setDraft(applied), [applied]);

  const [specs, setSpecs] = useState<Simple[]>([]); const [groups, setGroups] = useState<Simple[]>([]);
  const [forms, setForms] = useState<Simple[]>([]); const [locs, setLocs] = useState<Loc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]); const [boot, setBoot] = useState<"loading" | "ok" | "error">("loading");
  const [res, setRes] = useState<Result | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<Simple[]>("/api/catalog/specialities"), api<Simple[]>("/api/catalog/dosage-forms"),
      api<Simple[]>("/api/catalog/formulation-types"), api<Loc[]>("/api/locations")])
      .then(([a, b, c, d]) => { setSpecs(a); setGroups(b); setForms(c); setLocs(d); setBoot("ok"); }).catch(() => setBoot("error"));
  }, []);
  // Child options follow the parent: categories are re-fetched whenever the dosage form group changes.
  useEffect(() => {
    api<Cat[]>(`/api/catalog/product-categories${draft.group ? `?dosage_form_group_id=${draft.group}` : ""}`).then(setCats).catch(() => setCats([]));
  }, [draft.group]);

  const catOpts: Opt[] = useMemo(() => cats.map(c => ({ id: c.id, name: c.name, hint: draft.group ? undefined : c.dosage_form_group })), [cats, draft.group]);
  const stateOpts = useMemo(() => locs.filter(l => l.type === "STATE"), [locs]);
  const cityOpts = useMemo(() => locs.filter(l => l.type === "CITY" && l.parent_id === draft.state), [locs, draft.state]);
  const set = (patch: Partial<typeof draft>) => setDraft(d => ({ ...d, ...patch }));

  const hasCriteria = !!(applied.speciality || applied.group || applied.category || applied.formulation);
  const push = useCallback((o: typeof applied, t: Tab) => {
    const p = new URLSearchParams({ tab: t });
    const add = (k: string, v: number | "") => { if (v !== "") p.set(k, String(v)); };
    add("speciality", o.speciality); add("group", o.group); add("category", o.category); add("formulation", o.formulation);
    add("state", o.state); add("city", o.city);
    if (o.unverified) p.set("unverified", "1");
    if (o.page > 1) p.set("page", String(o.page));
    router.replace(`/find?${p.toString()}`, { scroll: false });
  }, [router]);

  const search = () => push({ ...draft, page: 1 }, tab);
  const clear = () => router.replace(`/find?tab=${tab}`, { scroll: false });
  const switchTab = (t: Tab) => { if (t !== tab) router.replace(`/find?tab=${t}`, { scroll: false }); };

  useEffect(() => {
    if (!hasCriteria) { setRes(null); setError(""); return; }
    const p = new URLSearchParams({ page: String(applied.page), page_size: String(PAGE_SIZE) });
    if (applied.speciality) p.set("speciality_id", String(applied.speciality));
    if (applied.group) p.set("dosage_form_group_id", String(applied.group));
    if (applied.category) p.set("product_category_id", String(applied.category));
    if (applied.formulation) p.set("formulation_type_id", String(applied.formulation));
    if (applied.state) p.set("state_id", String(applied.state));
    if (applied.city) p.set("city_id", String(applied.city));
    if (applied.unverified) p.set("include_unverified", "true");
    let live = true; setBusy(true); setError("");
    api<Result>(`/api/companies?${p.toString()}`).then(r => { if (live) setRes(r); })
      .catch(e => { if (live) setError(e.message || "Could not load results."); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [applied, hasCriteria]);

  const pages = res ? Math.max(1, Math.ceil(res.total / res.page_size)) : 1;
  const tabBtn = (t: Tab, text: string) => (
    <button type="button" role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}
      className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === t ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-white/70"}`}>{text}</button>);

  if (boot === "error") return <p className="glass rounded-xl border p-6 text-red-700">Could not load the search options. Please check your connection and reload.</p>;

  return (
    <div>
      <div role="tablist" className="glass mb-4 flex gap-2 rounded-2xl border p-1.5">
        {tabBtn("speciality", "Search by Speciality")}{tabBtn("category", "Search by Product Category")}
      </div>
      <form onSubmit={e => { e.preventDefault(); search(); }} className="glass rounded-2xl border p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tab === "speciality" ? (<>
            <SearchableSelect label="Speciality" value={draft.speciality} options={specs} onChange={v => set({ speciality: v })} placeholder="Any speciality" />
            <SearchableSelect label="Dosage form (optional)" value={draft.group} options={groups}
              onChange={v => set({ group: v, category: "" })} placeholder="Any dosage form" />
            <SearchableSelect label="Product category (optional)" value={draft.category} options={catOpts}
              onChange={v => set({ category: v })} placeholder="Any product category" />
          </>) : (<>
            <SearchableSelect label="1. Dosage form" value={draft.group} options={groups}
              onChange={v => set({ group: v, category: "" })} placeholder="Select a dosage form" />
            <SearchableSelect label="2. Product category" value={draft.category} options={catOpts} disabled={!draft.group}
              onChange={v => set({ category: v })} placeholder={draft.group ? "Any category in this form" : "Choose a dosage form first"} />
            <SearchableSelect label="Speciality (optional)" value={draft.speciality} options={specs}
              onChange={v => set({ speciality: v })} placeholder="Any speciality" />
          </>)}
          <SearchableSelect label="Formulation type (optional)" value={draft.formulation} options={forms}
            onChange={v => set({ formulation: v })} placeholder="Any formulation" />
          <SearchableSelect label="State (optional)" value={draft.state} options={stateOpts}
            onChange={v => set({ state: v, city: "" })} placeholder="Any state" />
          <SearchableSelect label="City (optional)" value={draft.city} options={cityOpts} disabled={!draft.state}
            onChange={v => set({ city: v })} placeholder={draft.state ? "Any city" : "Choose a state first"} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={draft.unverified} onChange={e => set({ unverified: e.target.checked })} />
            Also include companies whose capability is not yet verified
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={clear} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Clear filters</button>
            <button type="submit" className="bg-brand-600 rounded-lg px-6 py-2 text-sm font-semibold text-white">Search</button>
          </div>
        </div>
      </form>

      <section className="mt-6" aria-live="polite">
        {!hasCriteria && <p className="glass rounded-xl border p-8 text-center text-slate-600">
          {tab === "speciality" ? "Choose a speciality, then press Search." : "Choose a dosage form and product category, then press Search."}</p>}
        {hasCriteria && busy && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="glass h-52 animate-pulse rounded-2xl border" />)}</div>}
        {hasCriteria && !busy && error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}{" "}
            <button onClick={() => push(applied, tab)} className="font-semibold underline">Try again</button></div>)}
        {hasCriteria && !busy && !error && res && res.items.length === 0 && (
          <div className="glass rounded-xl border p-8 text-center text-slate-700">
            <p className="font-semibold">No companies match these filters.</p>
            <p className="mt-1 text-sm text-slate-600">Try removing a filter{!applied.unverified && ", or include companies whose capability is not yet verified"}.</p>
            <p className="mt-3 text-sm">Still nothing? <Link href="/post-requirement" className="font-semibold text-teal-800 underline">Post your requirement</Link> and we will find suppliers for you.</p></div>)}
        {hasCriteria && !busy && !error && res && res.items.length > 0 && (<>
          <p className="mb-3 text-sm text-slate-600">{res.total} compan{res.total === 1 ? "y" : "ies"} found</p>
          {applied.unverified && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">These results include companies whose speciality or product capability has been claimed but is <strong>not yet verified</strong> by PharmaConnect. Confirm directly with the company.</p>}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{res.items.map(c => <CompanyCard key={c.id} c={c} />)}</div>
          {pages > 1 && <div className="mt-8 flex items-center justify-center gap-4 text-sm">
            <button disabled={res.page <= 1} onClick={() => push({ ...applied, page: res.page - 1 }, tab)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">← Previous</button>
            <span>Page {res.page} of {pages}</span>
            <button disabled={res.page >= pages} onClick={() => push({ ...applied, page: res.page + 1 }, tab)} className="rounded-lg border bg-white px-3 py-1.5 disabled:opacity-40">Next →</button></div>}
        </>)}
      </section>
    </div>);
}
