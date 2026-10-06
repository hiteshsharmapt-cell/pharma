"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import AdminNav from "@/components/AdminNav";

type Company = { id: number; name: string; business_type: string; city: string | null; state: string | null;
  owner_name: string; owner_email: string; owner_mobile: string; status: string; created_at: string };
const TABS = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
const badge: Record<string, string> = { PENDING: "bg-amber-100 text-amber-800", APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800", SUSPENDED: "bg-slate-200 text-slate-700" };

export default function AdminCompanies() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [tab, setTab] = useState("PENDING"); const [q, setQ] = useState("");
  const [rows, setRows] = useState<Company[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState("");

  useEffect(() => { if (!loading && (!user || user.role !== "ADMIN")) router.replace("/login"); }, [user, loading, router]);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { setRows(await api<Company[]>(`/api/admin/companies?status=${tab}&q=${encodeURIComponent(q)}`)); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }, [tab, q]);
  useEffect(() => { if (user?.role === "ADMIN") load(); }, [user, load]);

  const setStatus = async (id: number, status: string) => {
    try { await api(`/api/admin/companies/${id}/status`, { method: "PATCH", json: { status } }); load(); }
    catch (e: any) { setError(e.message); }
  };
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Companies</h1>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map(t => <button key={t} onClick={() => setTab(t)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? "bg-brand-600 text-white" : "border bg-white"}`}>{t}</button>)}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email"
          className="ml-auto rounded-lg border px-3 py-1.5 text-sm" />
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="p-3">Company</th><th className="p-3">Owner</th><th className="p-3">Location</th>
            <th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {busy ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">No {tab.toLowerCase()} companies</td></tr>
              : rows.map(c => (
              <tr key={c.id} className="border-t">
                <td className="p-3"><div className="font-semibold">{c.name}</div><div className="text-xs text-slate-500">{c.business_type}</div></td>
                <td className="p-3"><div>{c.owner_name}</div><div className="text-xs text-slate-500">{c.owner_email} · {c.owner_mobile}</div></td>
                <td className="p-3">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[c.status]}`}>{c.status}</span></td>
                <td className="space-x-2 p-3 whitespace-nowrap">
                  {c.status !== "APPROVED" && <button onClick={() => setStatus(c.id, "APPROVED")} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Approve</button>}
                  {c.status === "PENDING" && <button onClick={() => setStatus(c.id, "REJECTED")} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white">Reject</button>}
                  {c.status === "APPROVED" && <button onClick={() => setStatus(c.id, "SUSPENDED")} className="rounded bg-slate-600 px-3 py-1 text-xs font-semibold text-white">Suspend</button>}
                </td></tr>))}
          </tbody>
        </table>
      </div>
    </div>);
}
