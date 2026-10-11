"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import AdminNav from "@/components/AdminNav";
import ImageUpload from "@/components/ImageUpload";

type Product = { id: number; name: string; composition: string | null; dosage_form: string | null; pack_size: string | null; image_url?: string | null;
  company: string; company_status: string; status: string };
const TABS = ["PENDING", "APPROVED", "REJECTED"];
const badge: Record<string, string> = { PENDING: "bg-amber-100 text-amber-800", APPROVED: "bg-emerald-100 text-emerald-800", REJECTED: "bg-red-100 text-red-800" };

export default function AdminProducts() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [tab, setTab] = useState("PENDING"); const [rows, setRows] = useState<Product[]>([]);
  const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  useEffect(() => { if (!loading && (!user || user.role !== "ADMIN")) router.replace("/login"); }, [user, loading, router]);
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { setRows(await api<Product[]>(`/api/admin/products?status=${tab}`)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }, [tab]);
  useEffect(() => { if (user?.role === "ADMIN") load(); }, [user, load]);
  const setStatus = async (id: number, status: string) => {
    try { await api(`/api/admin/products/${id}/status`, { method: "PATCH", json: { status } }); load(); } catch (e: any) { setError(e.message); }
  };
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      <h1 className="mb-4 text-2xl font-bold">Products</h1>
      <div className="mb-4 flex gap-2">{TABS.map(t => <button key={t} onClick={() => setTab(t)}
        className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t ? "bg-brand-600 text-white" : "border bg-white"}`}>{t}</button>)}</div>
      {error && <Alert>{error}</Alert>}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="p-3">Product</th><th className="p-3">Image</th><th className="p-3">Company</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{busy ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">No {tab.toLowerCase()} products</td></tr>
            : rows.map(p => (
            <tr key={p.id} className="border-t">
              <td className="p-3"><div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">{[p.composition, p.dosage_form, p.pack_size].filter(Boolean).join(" · ")}</div></td>
              <td className="p-3"><ImageUpload label="Image" field="image_url" size={48} src={p.image_url} path={`/api/admin/products/${p.id}/image`}
                onChange={u => setRows(rs => rs.map(r => r.id === p.id ? { ...r, image_url: u } : r))} /></td>
              <td className="p-3">{p.company}{p.company_status !== "APPROVED" && <div className="text-xs text-amber-700">Company {p.company_status.toLowerCase()} — not public yet</div>}</td>
              <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[p.status]}`}>{p.status}</span></td>
              <td className="space-x-2 p-3 whitespace-nowrap">
                {p.status !== "APPROVED" && <button onClick={() => setStatus(p.id, "APPROVED")} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Approve</button>}
                {p.status !== "REJECTED" && <button onClick={() => setStatus(p.id, "REJECTED")} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white">Reject</button>}
              </td></tr>))}</tbody>
        </table>
      </div>
    </div>);
}
