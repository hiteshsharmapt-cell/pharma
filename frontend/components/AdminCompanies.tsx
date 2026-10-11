"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import AdminNav from "@/components/AdminNav";

type Company = { id: number; name: string; business_type: string; city: string | null; state: string | null;
  owner_name: string; owner_email: string; owner_mobile: string; has_email: boolean; status: string; created_at: string };
const TABS = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
const badge: Record<string, string> = { PENDING: "bg-amber-100 text-amber-800", APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800", SUSPENDED: "bg-slate-200 text-slate-700" };

export default function AdminCompanies() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [tab, setTab] = useState("PENDING"); const [q, setQ] = useState("");
  const [rows, setRows] = useState<Company[]>([]); const [busy, setBusy] = useState(true); const [error, setError] = useState("");

  const [emailFor, setEmailFor] = useState<Company | null>(null); const [emailVal, setEmailVal] = useState("");
  const [resetPw, setResetPw] = useState(false); const [emailMsg, setEmailMsg] = useState(""); const [emailBusy, setEmailBusy] = useState(false);
  const openEmail = (c: Company) => { setEmailFor(c); setEmailVal(c.has_email ? c.owner_email : ""); setResetPw(false); setEmailMsg(""); };
  const saveEmail = async () => {
    if (!emailFor) return; setEmailBusy(true); setEmailMsg("");
    try {
      const r = await api<any>(`/api/admin/companies/${emailFor.id}/email`, { method: "PUT", json: { email: emailVal, reset_password: resetPw } });
      setEmailMsg(r.temporary_password ? `Saved. Temporary password (shown once — copy it now): ${r.temporary_password}` : "Saved.");
      setEmailFor({ ...emailFor, owner_email: r.email, has_email: true }); setResetPw(false); load();
    } catch (e: any) { setEmailMsg(e.message); } finally { setEmailBusy(false); }
  };
  const deleteEmail = async () => {
    if (!emailFor || !window.confirm(`Remove the email for "${emailFor.name}"? Its login stops working; the company stays listed.`)) return;
    setEmailBusy(true);
    try { await api(`/api/admin/companies/${emailFor.id}/email`, { method: "DELETE" }); setEmailFor(null); load(); }
    catch (e: any) { setEmailMsg(e.message); } finally { setEmailBusy(false); }
  };
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
  const remove = async (c: Company) => {
    if (!window.confirm(`Permanently delete "${c.name}"?\n\nThis removes the company, all its products, its leads and its supplier login. It cannot be undone.`)) return;
    try { await api(`/api/admin/companies/${c.id}`, { method: "DELETE" }); load(); }
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
                <td className="p-3"><div>{c.owner_name}</div><div className="text-xs text-slate-500">{c.has_email ? c.owner_email : <span className="italic text-amber-700">No email</span>} · {c.owner_mobile}</div></td>
                <td className="p-3">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[c.status]}`}>{c.status}</span></td>
                <td className="space-x-2 p-3 whitespace-nowrap">
                  {c.status !== "APPROVED" && <button onClick={() => setStatus(c.id, "APPROVED")} className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Approve</button>}
                  {c.status === "PENDING" && <button onClick={() => setStatus(c.id, "REJECTED")} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white">Reject</button>}
                  {c.status === "APPROVED" && <button onClick={() => setStatus(c.id, "SUSPENDED")} className="rounded bg-slate-600 px-3 py-1 text-xs font-semibold text-white">Suspend</button>}
                  <Link href={`/admin/companies/${c.id}/capabilities`} className="inline-block rounded border border-teal-300 px-3 py-1 text-xs font-semibold text-teal-800">Capabilities</Link>
                  <button onClick={() => openEmail(c)} className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold">{c.has_email ? "Email" : "Add email"}</button>
                  <button onClick={() => remove(c)} className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>
                </td></tr>))}
          </tbody>
        </table>
      </div>
      {emailFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEmailFor(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" style={{ background: "#fff" }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Email for {emailFor.name}</h2>
            <p className="mb-3 text-xs text-slate-500">This is the company's login email. Public pages never show it.</p>
            <input value={emailVal} onChange={e => setEmailVal(e.target.value)} type="email" placeholder="name@company.com"
              className="mb-2 w-full rounded-lg border px-3 py-2 text-sm" />
            <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={resetPw} onChange={e => setResetPw(e.target.checked)} />
              Generate a new temporary password{!emailFor.has_email && " (always done when adding a first email)"}</label>
            {emailMsg && <p className="mb-3 break-all rounded bg-slate-100 p-2 text-xs">{emailMsg}</p>}
            <div className="flex flex-wrap gap-2">
              <button disabled={emailBusy || !emailVal.trim()} onClick={saveEmail} className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{emailFor.has_email ? "Save" : "Add email"}</button>
              {emailFor.has_email && <button disabled={emailBusy} onClick={deleteEmail} className="rounded border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-700">Delete email</button>}
              <button onClick={() => setEmailFor(null)} className="ml-auto rounded border px-4 py-1.5 text-sm">Close</button>
            </div>
          </div>
        </div>)}
    </div>);
}
