"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import AdminNav from "@/components/AdminNav";

type Kind = "specialities" | "dosage-forms" | "product-categories" | "formulation-types";
const KINDS: { kind: Kind; label: string; one: string }[] = [
  { kind: "specialities", label: "Specialities", one: "speciality" }, { kind: "dosage-forms", label: "Dosage forms", one: "dosage form group" },
  { kind: "product-categories", label: "Product categories", one: "product category" }, { kind: "formulation-types", label: "Formulation types", one: "formulation type" }];
type Item = { id: number; name: string; slug: string; description: string | null; is_active: boolean; in_use: number;
  dosage_form_group_id?: number; dosage_form_group?: string; parent_id?: number | null; speciality_ids?: number[] };
type Page = { items: Item[]; total: number; page: number; page_size: number };
type Draft = { name: string; description: string; dosage_form_group_id: number | ""; parent_id: number | ""; speciality_ids: number[] };
const PAGE = 20;
const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export default function AdminCatalog() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [kind, setKind] = useState<Kind>("specialities"); const [q, setQ] = useState(""); const [active, setActive] = useState("all");
  const [groupFilter, setGroupFilter] = useState<number | "">(""); const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null); const [busy, setBusy] = useState(true); const [error, setError] = useState(""); const [msg, setMsg] = useState("");
  const [groups, setGroups] = useState<Item[]>([]); const [specs, setSpecs] = useState<Item[]>([]); const [allCats, setAllCats] = useState<Item[]>([]);
  const [editing, setEditing] = useState<number | "new" | null>(null);

  useEffect(() => { if (!loading && (!user || user.role !== "ADMIN")) router.replace("/login"); }, [user, loading, router]);
  const loadRefs = useCallback(async () => {
    const g = (k: string) => api<Page>(`/api/admin/catalog/${k}?page_size=100`).then(r => r.items);
    const [a, b, c] = await Promise.all([g("dosage-forms"), g("specialities"), g("product-categories")]);
    setGroups(a); setSpecs(b); setAllCats(c);
  }, []);
  useEffect(() => { if (user?.role === "ADMIN") loadRefs().catch(e => setError(e.message)); }, [user, loadRefs]);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    const p = new URLSearchParams({ page: String(page), page_size: String(PAGE) });
    if (q.trim()) p.set("q", q.trim()); if (active !== "all") p.set("active", String(active === "active"));
    if (kind === "product-categories" && groupFilter) p.set("dosage_form_group_id", String(groupFilter));
    try { setData(await api<Page>(`/api/admin/catalog/${kind}?${p}`)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }, [kind, q, active, groupFilter, page]);
  useEffect(() => { if (user?.role === "ADMIN") { const t = setTimeout(load, 200); return () => clearTimeout(t); } }, [user, load]);
  useEffect(() => { setPage(1); setEditing(null); }, [kind, q, active, groupFilter]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(""); setMsg("");
    try { await fn(); setMsg(ok); setEditing(null); await Promise.all([load(), loadRefs()]); } catch (e: any) { setError(e.message); }
  };
  const save = (id: number | "new", d: Draft) => {
    const body: any = { name: d.name, description: d.description || null };
    if (kind === "product-categories") {
      body.dosage_form_group_id = d.dosage_form_group_id || undefined; body.speciality_ids = d.speciality_ids;
      if (id === "new") body.parent_id = d.parent_id || null; else { body.parent_id = d.parent_id || undefined; body.clear_parent = !d.parent_id; }
    }
    return run(() => api(id === "new" ? `/api/admin/catalog/${kind}` : `/api/admin/catalog/${kind}/${id}`,
      { method: id === "new" ? "POST" : "PATCH", json: body }), id === "new" ? "Added." : "Saved.");
  };
  const toggle = (i: Item) => run(() => api(`/api/admin/catalog/${kind}/${i.id}`, { method: "PATCH", json: { is_active: !i.is_active } }), i.is_active ? "Deactivated." : "Activated.");
  const remove = (i: Item) => { if (window.confirm(`Delete "${i.name}"? It is not used anywhere. This cannot be undone.`)) run(() => api(`/api/admin/catalog/${kind}/${i.id}`, { method: "DELETE" }), "Deleted."); };

  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  const cur = KINDS.find(k => k.kind === kind)!; const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const catName = (id?: number | null) => allCats.find(c => c.id === id)?.name;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-1 text-2xl font-bold">Catalogue</h1>
      <p className="mb-4 text-sm text-slate-600">Manage specialities, dosage forms, product categories and formulation types. Entries in use are deactivated, never deleted.</p>
      <div className="mb-4 flex flex-wrap gap-2">{KINDS.map(k => (
        <button key={k.kind} onClick={() => setKind(k.kind)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${kind === k.kind ? "bg-brand-600 text-white" : "border bg-white"}`}>{k.label}</button>))}</div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${cur.label.toLowerCase()}`} className={input} />
        <select value={active} onChange={e => setActive(e.target.value)} className={input} aria-label="Status filter"><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        {kind === "product-categories" && <select value={groupFilter} onChange={e => setGroupFilter(e.target.value ? Number(e.target.value) : "")} className={input} aria-label="Dosage form filter">
          <option value="">All dosage forms</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
        <button onClick={() => setEditing("new")} className="bg-brand-600 ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-white">+ Add {cur.one}</button>
      </div>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      {msg && <p className="mb-3 text-sm font-medium text-emerald-700">{msg}</p>}
      {editing === "new" && <Form kind={kind} groups={groups} specs={specs} cats={allCats} onSave={d => save("new", d)} onCancel={() => setEditing(null)} />}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Name</th>
            {kind === "product-categories" && <th className="p-3">Dosage form / parent</th>}<th className="p-3">In use</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {busy && !data ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading…</td></tr>
              : data?.items.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Nothing found.</td></tr>
              : data?.items.map(i => editing === i.id ? (
                <tr key={i.id} className="border-t"><td colSpan={5} className="p-3"><Form kind={kind} item={i} groups={groups} specs={specs} cats={allCats} onSave={d => save(i.id, d)} onCancel={() => setEditing(null)} /></td></tr>
              ) : (
                <tr key={i.id} className={`border-t ${i.is_active ? "" : "bg-slate-50 text-slate-500"}`}>
                  <td className="p-3"><div className="font-semibold">{i.name}</div>{i.description && <div className="max-w-md truncate text-xs text-slate-500">{i.description}</div>}</td>
                  {kind === "product-categories" && <td className="p-3">{i.dosage_form_group}{i.parent_id ? <span className="text-slate-500"> · under {catName(i.parent_id)}</span> : null}</td>}
                  <td className="p-3">{i.in_use}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{i.is_active ? "Active" : "Inactive"}</span></td>
                  <td className="space-x-2 whitespace-nowrap p-3">
                    <button onClick={() => setEditing(i.id)} className="rounded border px-3 py-1 text-xs font-semibold">Edit</button>
                    <button onClick={() => toggle(i)} className="rounded border px-3 py-1 text-xs font-semibold">{i.is_active ? "Deactivate" : "Activate"}</button>
                    {i.in_use === 0 && <button onClick={() => remove(i)} className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700">Delete</button>}
                  </td></tr>))}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="mt-4 flex items-center justify-center gap-4 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border bg-white px-3 py-1 disabled:opacity-40">← Previous</button>
        <span>Page {page} of {pages} · {data?.total} total</span>
        <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="rounded border bg-white px-3 py-1 disabled:opacity-40">Next →</button></div>}
    </div>);
}

function Form({ kind, item, groups, specs, cats, onSave, onCancel }: { kind: Kind; item?: Item; groups: Item[]; specs: Item[]; cats: Item[];
  onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>({ name: item?.name ?? "", description: item?.description ?? "", dosage_form_group_id: item?.dosage_form_group_id ?? "",
    parent_id: item?.parent_id ?? "", speciality_ids: item?.speciality_ids ?? [] });
  const isCat = kind === "product-categories";
  const parents = cats.filter(c => c.dosage_form_group_id === d.dosage_form_group_id && c.id !== item?.id);
  const ok = d.name.trim().length >= 2 && (!isCat || d.dosage_form_group_id !== "");
  return (
    <form onSubmit={e => { e.preventDefault(); if (ok) onSave(d); }} className="mb-4 space-y-3 rounded-xl border border-teal-300 bg-teal-50/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">Name<input value={d.name} onChange={e => setD({ ...d, name: e.target.value })} className={`${input} mt-1 w-full`} required minLength={2} /></label>
        <label className="block text-sm font-medium">Description (optional)<input value={d.description} onChange={e => setD({ ...d, description: e.target.value })} className={`${input} mt-1 w-full`} /></label>
        {isCat && <>
          <label className="block text-sm font-medium">Dosage form group
            <select value={d.dosage_form_group_id} onChange={e => setD({ ...d, dosage_form_group_id: e.target.value ? Number(e.target.value) : "", parent_id: "" })} className={`${input} mt-1 w-full`} required>
              <option value="">Select…</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label className="block text-sm font-medium">Parent category (optional)
            <select value={d.parent_id} onChange={e => setD({ ...d, parent_id: e.target.value ? Number(e.target.value) : "" })} className={`${input} mt-1 w-full`} disabled={d.dosage_form_group_id === ""}>
              <option value="">None (top level)</option>{parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></>}
      </div>
      {isCat && <fieldset><legend className="mb-1 text-sm font-medium">Suggested for specialities (optional; does not assign anything to companies)</legend>
        <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-auto rounded-lg border bg-white p-2 text-sm">
          {specs.filter(s => s.is_active || d.speciality_ids.includes(s.id)).map(s => (
            <label key={s.id} className="flex items-center gap-1.5"><input type="checkbox" checked={d.speciality_ids.includes(s.id)}
              onChange={e => setD({ ...d, speciality_ids: e.target.checked ? [...d.speciality_ids, s.id] : d.speciality_ids.filter(x => x !== s.id) })} />{s.name}</label>))}</div></fieldset>}
      <div className="flex gap-2"><button disabled={!ok} className="bg-brand-600 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
        <button type="button" onClick={onCancel} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">Cancel</button></div>
    </form>);
}
