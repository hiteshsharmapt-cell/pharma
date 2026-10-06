"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import AdminNav from "@/components/AdminNav";

type Req = { id: number; buyer_name: string; buyer_mobile: string; buyer_email: string; city: string | null; state: string | null;
  requirement_type: string; category: string | null; drug_license_status: string; gst_status: string; message: string;
  status: string; created_at: string; assigned: { lead_id: number; company: string; status: string }[] };
type Supplier = { id: number; name: string };

export default function AdminRequirements() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [rows, setRows] = useState<Req[]>([]); const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pick, setPick] = useState<Record<number, string>>({}); const [busy, setBusy] = useState(true); const [error, setError] = useState("");

  useEffect(() => { if (!loading && (!user || user.role !== "ADMIN")) router.replace("/login"); }, [user, loading, router]);
  const load = useCallback(async () => {
    setError("");
    try {
      const [r, s] = await Promise.all([api<Req[]>("/api/admin/requirements"), api<Supplier[]>("/api/admin/suppliers")]);
      setRows(r); setSuppliers(s);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }, []);
  useEffect(() => { if (user?.role === "ADMIN") load(); }, [user, load]);

  const assign = async (id: number) => {
    const supplier_id = Number(pick[id]); if (!supplier_id) return;
    try { await api(`/api/admin/requirements/${id}/assign`, { method: "POST", json: { supplier_id } }); setPick(p => ({ ...p, [id]: "" })); load(); }
    catch (e: any) { setError(e.message); }
  };
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Buyer Requirements</h1>
      {error && <Alert>{error}</Alert>}
      {busy ? <p className="p-6 text-center text-slate-500">Loading…</p> : rows.length === 0 ?
        <p className="rounded-xl border bg-white p-10 text-center text-slate-500">No requirements yet.</p> :
        <div className="space-y-4">{rows.map(r => (
          <article key={r.id} className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><div className="font-semibold">#{r.id} · {r.buyer_name}</div>
                <div className="text-sm text-slate-500">{r.buyer_mobile} · {r.buyer_email}</div>
                <div className="text-sm text-slate-500">{[r.city, r.state].filter(Boolean).join(", ")} · {new Date(r.created_at).toLocaleDateString()}</div></div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{r.status}</span>
            </div>
            <p className="mt-3 text-sm"><b>{r.requirement_type}</b>{r.category ? ` · ${r.category}` : ""} · Drug licence: {r.drug_license_status} · GST: {r.gst_status}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{r.message}</p>
            {r.assigned.length > 0 && <p className="mt-3 text-sm">Assigned to: {r.assigned.map(a => `${a.company} (${a.status})`).join(", ")}</p>}
            <div className="mt-4 flex gap-2">
              <select value={pick[r.id] ?? ""} onChange={e => setPick(p => ({ ...p, [r.id]: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                <option value="">Select supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={() => assign(r.id)} disabled={!pick[r.id]} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Assign Lead</button>
            </div>
          </article>))}</div>}
    </div>);
}
