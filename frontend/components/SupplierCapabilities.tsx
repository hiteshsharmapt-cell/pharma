"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import SupplierNav from "@/components/SupplierNav";

type Simple = { id: number; name: string; description?: string | null };
type Cat = Simple & { dosage_form_group_id: number; dosage_form_group: string; parent_id: number | null };
type Status = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
type Mine = { specialities: { speciality_id: number; verification_status: Status }[]; capabilities: { product_category_id: number; verification_status: Status; formulation_type_ids: number[] }[] };
const LABEL: Record<Status, [string, string]> = { UNVERIFIED: ["Unverified", "bg-slate-200 text-slate-700"], PENDING: ["Pending verification", "bg-amber-100 text-amber-800"],
  VERIFIED: ["Verified", "bg-emerald-100 text-emerald-800"], REJECTED: ["Rejected", "bg-red-100 text-red-800"] };
const Badge = ({ s }: { s?: Status }) => s ? <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${LABEL[s][1]}`}>{LABEL[s][0]}</span> : null;

export default function SupplierCapabilities() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [specs, setSpecs] = useState<Simple[]>([]); const [cats, setCats] = useState<Cat[]>([]); const [forms, setForms] = useState<Simple[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const [selSpecs, setSelSpecs] = useState<Set<number>>(new Set()); const [selCats, setSelCats] = useState<Map<number, number[]>>(new Map());
  const [error, setError] = useState(""); const [msg, setMsg] = useState(""); const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && (!user || user.role !== "SUPPLIER")) router.replace("/login"); }, [user, loading, router]);
  const apply = (m: Mine) => { setMine(m); setSelSpecs(new Set(m.specialities.map(s => s.speciality_id)));
    setSelCats(new Map(m.capabilities.map(c => [c.product_category_id, c.formulation_type_ids]))); };
  useEffect(() => {
    if (user?.role !== "SUPPLIER") return;
    Promise.all([api<Simple[]>("/api/catalog/specialities"), api<Cat[]>("/api/catalog/product-categories"), api<Simple[]>("/api/catalog/formulation-types"), api<Mine>("/api/supplier/capabilities")])
      .then(([a, b, c, m]) => { setSpecs(a); setCats(b); setForms(c); apply(m); }).catch(e => setError(e.message));
  }, [user]);

  const grouped = useMemo(() => {
    const out = new Map<string, { cat: Cat; depth: number }[]>();
    const kids = (pid: number | null, g: number, depth: number): { cat: Cat; depth: number }[] =>
      cats.filter(c => c.dosage_form_group_id === g && c.parent_id === pid).flatMap(c => [{ cat: c, depth }, ...kids(c.id, g, depth + 1)]);
    for (const c of cats) if (!out.has(c.dosage_form_group)) out.set(c.dosage_form_group, kids(null, c.dosage_form_group_id, 0));
    return [...out.entries()];
  }, [cats]);
  const specStatus = (id: number) => mine?.specialities.find(s => s.speciality_id === id)?.verification_status;
  const capStatus = (id: number) => mine?.capabilities.find(c => c.product_category_id === id)?.verification_status;

  const toggleSpec = (id: number, on: boolean) => setSelSpecs(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  const toggleCat = (id: number, on: boolean) => setSelCats(m => { const n = new Map(m); on ? n.set(id, n.get(id) ?? []) : n.delete(id); return n; });
  const toggleForm = (cid: number, fid: number, on: boolean) => setSelCats(m => { const n = new Map(m); const cur = n.get(cid) ?? []; n.set(cid, on ? [...cur, fid] : cur.filter(x => x !== fid)); return n; });

  const save = async () => {
    setSaving(true); setError(""); setMsg("");
    try {
      await api("/api/supplier/capabilities", { method: "PUT", json: { speciality_ids: [...selSpecs], capabilities: [...selCats].map(([product_category_id, formulation_type_ids]) => ({ product_category_id, formulation_type_ids })) } });
      apply(await api<Mine>("/api/supplier/capabilities")); setMsg("Saved. New items are shown as pending until PharmaConnect verifies them.");
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <SupplierNav />
      <h1 className="text-2xl font-bold">Specialities &amp; manufacturing capabilities</h1>
      <p className="mb-5 mt-1 text-sm text-slate-600">Tick what your company genuinely works in. Buyers only see an item as confirmed after PharmaConnect has verified it, so please be accurate and be ready to share proof such as licences or certificates.</p>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}{msg && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}

      <section className="mb-8 rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Specialities</h2>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{specs.map(s => (
          <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selSpecs.has(s.id)} onChange={e => toggleSpec(s.id, e.target.checked)} />
            {s.name}{selSpecs.has(s.id) && <Badge s={specStatus(s.id)} />}</label>))}</div></section>

      <section className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Product categories you manufacture</h2>
        <div className="space-y-5">{grouped.map(([group, rows]) => (
          <div key={group}><h3 className="mb-2 text-sm font-semibold text-slate-500">{group}</h3>
            <div className="space-y-1.5">{rows.map(({ cat, depth }) => (
              <div key={cat.id} style={{ marginLeft: depth * 20 }}>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selCats.has(cat.id)} onChange={e => toggleCat(cat.id, e.target.checked)} />
                  {cat.name}{selCats.has(cat.id) && <Badge s={capStatus(cat.id)} />}</label>
                {selCats.has(cat.id) && <div className="ml-6 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600"><span>Formulation (optional):</span>{forms.map(f => (
                  <label key={f.id} className="flex items-center gap-1"><input type="checkbox" checked={selCats.get(cat.id)!.includes(f.id)} onChange={e => toggleForm(cat.id, f.id, e.target.checked)} />{f.name}</label>))}</div>}
              </div>))}</div></div>))}</div></section>
      <div className="mt-6"><button onClick={save} disabled={saving} className="bg-brand-600 rounded-lg px-6 py-2.5 font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save"}</button></div>
    </div>);
}
