"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, TOKEN_KEY } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import AdminNav from "@/components/AdminNav";

type Row = { id: number; name: string; phone: string | null; email: string | null; requirement: string | null;
  source: string; page: string | null; created_at: string };
type Data = { items: Row[]; total: number; page: number; page_size: number };
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SOURCES = ["", "popup", "chat", "ticket"];
const badge: Record<string, string> = { popup: "bg-teal-100 text-teal-800", chat: "bg-violet-100 text-violet-800", ticket: "bg-amber-100 text-amber-800" };

export default function AdminContacts() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [q, setQ] = useState(""); const [source, setSource] = useState(""); const [page, setPage] = useState(1);
  const [data, setData] = useState<Data>({ items: [], total: 0, page: 1, page_size: 50 });
  const [busy, setBusy] = useState(true); const [error, setError] = useState("");
  useEffect(() => { if (!loading && (!user || user.role !== "ADMIN")) router.replace("/login"); }, [user, loading, router]);

  const qs = (extra = "") => `q=${encodeURIComponent(q)}&source=${source}${extra}`;
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { setData(await api<Data>(`/api/admin/contacts?${qs(`&page=${page}`)}`)); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }, [q, source, page]);
  useEffect(() => { setPage(1); }, [q, source]);
  useEffect(() => { if (user?.role === "ADMIN") { const t = setTimeout(load, 250); return () => clearTimeout(t); } }, [user, load]);

  const remove = async (r: Row) => {
    if (!window.confirm(`Delete ${r.name}${r.phone ? ` (${r.phone})` : ""}? This cannot be undone.`)) return;
    try { await api(`/api/admin/contacts/${r.id}`, { method: "DELETE" }); load(); } catch (e: any) { setError(e.message); }
  };
  const download = async () => {
    try {
      const res = await fetch(`${BASE}/api/admin/contacts/export.csv?${qs()}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` } });
      if (!res.ok) throw new Error("Could not download the file");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a"); a.href = url; a.download = "contacts.csv"; a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message); }
  };
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-bold">Contacts <span className="text-base font-normal text-slate-500">({data.total})</span></h1>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, number, email, requirement" className="min-w-[16rem] rounded-lg border px-3 py-1.5 text-sm" />
        <select value={source} onChange={e => setSource(e.target.value)} className="rounded-lg border bg-white px-3 py-1.5 text-sm" aria-label="Source">
          {SOURCES.map(s => <option key={s} value={s}>{s ? `Source: ${s}` : "All sources"}</option>)}</select>
        <button onClick={download} className="bg-brand-600 ml-auto rounded-lg px-4 py-1.5 text-sm font-semibold text-white">Download CSV</button>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="p-3">Date</th><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Requirement</th><th className="p-3">Source</th><th className="p-3"></th></tr></thead>
          <tbody>{busy ? <tr><td colSpan={6} className="p-6 text-center text-slate-500">Loading…</td></tr>
            : data.items.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-slate-500">No contacts yet</td></tr>
            : data.items.map(r => (
            <tr key={r.id} className="border-t align-top">
              <td className="whitespace-nowrap p-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className="p-3"><div className="font-semibold">{r.name}</div>{r.email && <div className="text-xs text-slate-500">{r.email}</div>}</td>
              <td className="whitespace-nowrap p-3">{r.phone ? <a href={`tel:${r.phone}`} className="font-medium text-teal-800">{r.phone}</a> : <span className="text-slate-400">—</span>}</td>
              <td className="max-w-xs p-3"><div className="line-clamp-3 whitespace-pre-wrap">{r.requirement ?? "—"}</div>{r.page && <div className="mt-0.5 text-xs text-slate-400">from {r.page}</div>}</td>
              <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[r.source] ?? "bg-slate-100"}`}>{r.source}</span></td>
              <td className="p-3 text-right"><button onClick={() => remove(r)} className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button></td>
            </tr>))}</tbody>
        </table>
      </div>
      {pages > 1 && <div className="mt-4 flex items-center justify-center gap-4 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">← Previous</button>
        <span>Page {page} of {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Next →</button></div>}
    </div>);
}
