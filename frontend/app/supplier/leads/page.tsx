"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import SupplierNav from "@/components/SupplierNav";

type Lead = { id: number; status: string; assigned_at: string; buyer_name: string; buyer_mobile: string; buyer_email: string;
  city: string | null; state: string | null; requirement_type: string; category: string | null;
  drug_license_status: string; gst_status: string; message: string };
const STATUSES = ["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "CLOSED"];

export default function SupplierLeads() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  useEffect(() => { if (!loading && (!user || user.role !== "SUPPLIER")) router.replace("/login"); }, [user, loading, router]);
  const load = useCallback(async () => {
    try { setLeads(await api<Lead[]>("/api/leads")); setError(""); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }, []);
  useEffect(() => { if (user?.role === "SUPPLIER") load(); }, [user, load]);

  const setStatus = async (id: number, status: string) => {
    try { await api(`/api/leads/${id}`, { method: "PATCH", json: { status } }); load(); } catch (e: any) { setError(e.message); }
  };
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SupplierNav />
      <h1 className="mb-4 text-2xl font-bold">My Leads</h1>
      {error && <Alert>{error}</Alert>}
      {busy ? <p className="p-6 text-center text-slate-500">Loading…</p> : !error && leads.length === 0 ?
        <p className="rounded-xl border bg-white p-10 text-center text-slate-500">No leads assigned yet.</p> :
        <div className="space-y-4">{leads.map(l => (
          <article key={l.id} className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="font-semibold">{l.buyer_name}</div>
                <div className="text-sm"><a href={`tel:${l.buyer_mobile}`} className="text-brand-600">{l.buyer_mobile}</a> · <a href={`mailto:${l.buyer_email}`} className="text-brand-600">{l.buyer_email}</a></div>
                <div className="text-sm text-slate-500">{[l.city, l.state].filter(Boolean).join(", ")} · assigned {new Date(l.assigned_at).toLocaleDateString()}</div></div>
              <select value={l.status} onChange={e => setStatus(l.id, e.target.value)} className="rounded-lg border px-3 py-2 text-sm font-semibold">
                {STATUSES.map(s => <option key={s}>{s}</option>)}</select>
            </div>
            <p className="mt-3 text-sm"><b>{l.requirement_type}</b>{l.category ? ` · ${l.category}` : ""} · Drug licence: {l.drug_license_status} · GST: {l.gst_status}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{l.message}</p>
          </article>))}</div>}
    </div>);
}
