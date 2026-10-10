"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import AdminNav from "@/components/AdminNav";
import SearchableSelect from "@/components/SearchableSelect";

type Status = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
const STATUS: { v: Status; label: string; cls: string }[] = [
  { v: "UNVERIFIED", label: "Unverified", cls: "bg-slate-200 text-slate-700" }, { v: "PENDING", label: "Pending Verification", cls: "bg-amber-100 text-amber-800" },
  { v: "VERIFIED", label: "Verified", cls: "bg-emerald-100 text-emerald-800" }, { v: "REJECTED", label: "Rejected", cls: "bg-red-100 text-red-800" }];
type Spec = { speciality_id: number; name: string; verification_status: Status; evidence_source: string | null; notes: string | null };
type Cap = { category_id: number; name: string; dosage_form_group: string; verification_status: Status; evidence_source: string | null; notes: string | null; formulation_type_ids: number[] };
type Data = { company: { id: number; name: string; status: string; city: string | null; state: string | null }; specialities: Spec[]; capabilities: Cap[] };
type Simple = { id: number; name: string; is_active?: boolean }; type CatalogCat = Simple & { dosage_form_group: string };
const field = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm";

export default function AdminCompanyCapabilities() {
  const { user, loading } = useAuth(); const router = useRouter(); const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null); const [specs, setSpecs] = useState<Simple[]>([]); const [cats, setCats] = useState<CatalogCat[]>([]); const [forms, setForms] = useState<Simple[]>([]);
  const [error, setError] = useState(""); const [msg, setMsg] = useState("");
  const [addSpec, setAddSpec] = useState<number | "">(""); const [addCat, setAddCat] = useState<number | "">("");

  useEffect(() => { if (!loading && (!user || user.role !== "ADMIN")) router.replace("/login"); }, [user, loading, router]);
  const load = useCallback(async () => {
    try { setD(await api<Data>(`/api/admin/companies/${id}/capabilities`)); } catch (e: any) { setError(e.message); }
  }, [id]);
  useEffect(() => {
    if (user?.role !== "ADMIN") return; load();
    Promise.all([api<Simple[]>("/api/catalog/specialities"), api<CatalogCat[]>("/api/catalog/product-categories"), api<Simple[]>("/api/catalog/formulation-types")])
      .then(([a, b, c]) => { setSpecs(a); setCats(b); setForms(c); }).catch(e => setError(e.message));
  }, [user, load]);

  const call = async (fn: () => Promise<unknown>, ok: string) => { setError(""); setMsg(""); try { await fn(); setMsg(ok); await load(); } catch (e: any) { setError(e.message); } };
  const saveSpec = (s: { speciality_id: number }, b: object) => call(() => api(`/api/admin/companies/${id}/specialities/${s.speciality_id}`, { method: "PUT", json: b }), "Saved.");
  const saveCap = (c: { category_id: number }, b: object) => call(() => api(`/api/admin/companies/${id}/capabilities/${c.category_id}`, { method: "PUT", json: b }), "Saved.");
  const freeSpecs = useMemo(() => specs.filter(s => !d?.specialities.some(x => x.speciality_id === s.id)), [specs, d]);
  const freeCats = useMemo(() => cats.filter(c => !d?.capabilities.some(x => x.category_id === c.id)).map(c => ({ id: c.id, name: c.name, hint: c.dosage_form_group })), [cats, d]);
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav />
      <Link href="/admin/companies" className="text-sm text-teal-800">← Back to companies</Link>
      <h1 className="mt-2 text-2xl font-bold">{d?.company.name ?? "Company"} <span className="text-base font-normal text-slate-500">· capabilities</span></h1>
      {d && <p className="text-sm text-slate-500">{[d.company.city, d.company.state].filter(Boolean).join(", ")} · company status {d.company.status}</p>}
      <p className="mb-4 mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Only <strong>Verified</strong> claims are shown to buyers as confirmed. Record evidence (certificate, licence, audit or site visit) or notes before marking a claim Verified.</p>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}{msg && <p className="mb-3 text-sm font-medium text-emerald-700">{msg}</p>}

      <h2 className="mb-2 font-semibold">Specialities</h2>
      <div className="mb-3 flex items-end gap-2"><div className="w-72"><SearchableSelect label="Add a speciality" value={addSpec} options={freeSpecs} onChange={setAddSpec} placeholder="Choose…" /></div>
        <button disabled={addSpec === ""} onClick={() => { saveSpec({ speciality_id: addSpec as number }, { verification_status: "UNVERIFIED" }); setAddSpec(""); }} className="bg-brand-600 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Add (unverified)</button></div>
      <div className="space-y-2">{d?.specialities.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">No specialities claimed.</p>}
        {d?.specialities.map(s => <Row key={s.speciality_id} title={s.name} claim={s} onSave={b => saveSpec(s, b)}
          onRemove={() => call(() => api(`/api/admin/companies/${id}/specialities/${s.speciality_id}`, { method: "DELETE" }), "Removed.")} />)}</div>

      <h2 className="mb-2 mt-8 font-semibold">Manufacturing capabilities (product categories)</h2>
      <div className="mb-3 flex items-end gap-2"><div className="w-72"><SearchableSelect label="Add a product category" value={addCat} options={freeCats} onChange={setAddCat} placeholder="Choose…" /></div>
        <button disabled={addCat === ""} onClick={() => { saveCap({ category_id: addCat as number }, { verification_status: "UNVERIFIED" }); setAddCat(""); }} className="bg-brand-600 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Add (unverified)</button></div>
      <div className="space-y-2">{d?.capabilities.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">No product categories claimed.</p>}
        {d?.capabilities.map(c => <Row key={c.category_id} title={c.name} sub={c.dosage_form_group} claim={c} forms={forms} onSave={b => saveCap(c, b)}
          onRemove={() => call(() => api(`/api/admin/companies/${id}/capabilities/${c.category_id}`, { method: "DELETE" }), "Removed.")} />)}</div>
    </div>);
}

function Row({ title, sub, claim, forms, onSave, onRemove }: { title: string; sub?: string;
  claim: { verification_status: Status; evidence_source: string | null; notes: string | null; formulation_type_ids?: number[] };
  forms?: Simple[]; onSave: (b: object) => void; onRemove: () => void }) {
  const [st, setSt] = useState(claim.verification_status); const [ev, setEv] = useState(claim.evidence_source ?? ""); const [nt, setNt] = useState(claim.notes ?? "");
  const [ft, setFt] = useState<number[]>(claim.formulation_type_ids ?? []);
  useEffect(() => { setSt(claim.verification_status); setEv(claim.evidence_source ?? ""); setNt(claim.notes ?? ""); setFt(claim.formulation_type_ids ?? []); }, [claim]);
  const badge = STATUS.find(s => s.v === claim.verification_status)!;
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-semibold">{title}</span>{sub && <span className="text-xs text-slate-500">{sub}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={st} onChange={e => setSt(e.target.value as Status)} className={field} aria-label="Verification status">{STATUS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}</select>
        <input value={ev} onChange={e => setEv(e.target.value)} placeholder="Evidence / source (e.g. WHO-GMP certificate no.)" className={field} maxLength={300} />
        <input value={nt} onChange={e => setNt(e.target.value)} placeholder="Notes" className={field} />
      </div>
      {forms && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span className="text-slate-500">Formulation:</span>{forms.map(f => (
        <label key={f.id} className="flex items-center gap-1"><input type="checkbox" checked={ft.includes(f.id)} onChange={e => setFt(e.target.checked ? [...ft, f.id] : ft.filter(x => x !== f.id))} />{f.name}</label>))}</div>}
      <div className="mt-2 flex gap-2">
        <button onClick={() => onSave({ verification_status: st, evidence_source: ev || null, notes: nt || null, ...(forms ? { formulation_type_ids: ft } : {}) })} className="bg-brand-600 rounded-lg px-3 py-1.5 text-xs font-semibold text-white">Save</button>
        <button onClick={() => window.confirm(`Remove "${title}" from this company?`) && onRemove()} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Remove</button></div>
    </div>);
}
