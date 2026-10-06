"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import AdminNav from "@/components/AdminNav";

type Row = { id: number; name: string; city: string | null; state: string | null };
const MAX = 12, TOP = 5;

export default function AdminFeatured() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [list, setList] = useState<Row[]>([]);
  const [results, setResults] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState(false); const [msg, setMsg] = useState(""); const [error, setError] = useState("");

  useEffect(() => { if (!loading && (!user || user.role !== "ADMIN")) router.replace("/login"); }, [user, loading, router]);
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    api<Row[]>("/api/admin/featured").then(setList).catch(e => setError(e.message));
  }, [user]);

  const search = useCallback(async () => {
    try { setResults((await api<Row[]>(`/api/admin/companies?status=APPROVED&q=${encodeURIComponent(q)}`)).slice(0, 15)); }
    catch (e: any) { setError(e.message); }
  }, [q]);
  useEffect(() => { if (user?.role !== "ADMIN") return; const t = setTimeout(search, 250); return () => clearTimeout(t); }, [search, user]);

  const change = (next: Row[]) => { setList(next); setDirty(true); setMsg(""); };
  const move = (i: number, d: number) => { const n = [...list]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; change(n); };
  const remove = (i: number) => change(list.filter((_, k) => k !== i));
  const add = (r: Row) => { if (list.length >= MAX || list.some(x => x.id === r.id)) return; change([...list, r]); };
  const save = async () => {
    setError("");
    try { await api("/api/admin/featured", { method: "PUT", json: { company_ids: list.map(x => x.id) } }); setDirty(false); setMsg("Saved. The homepage updates within a minute."); }
    catch (e: any) { setError(e.message); }
  };
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  const btn = "rounded border bg-white px-2 py-1 text-xs font-semibold disabled:opacity-30";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      <h1 className="text-2xl font-bold">Featured companies</h1>
      <p className="mb-5 mt-1 text-sm text-slate-600">Choose up to {MAX} companies for the homepage and set their order. The first {TOP} are highlighted as “Top {TOP}”.</p>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">On the homepage ({list.length}/{MAX})</h2>
            <button onClick={save} disabled={!dirty} className="bg-brand-600 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Save changes</button>
          </div>
          {msg && <p className="mb-2 text-sm font-medium text-emerald-700">{msg}</p>}
          {list.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nothing chosen yet. The homepage is showing the latest companies. Add some from the right.</p>}
          <ol className="space-y-2">{list.map((c, i) => (
            <li key={c.id}>
              {i === TOP && <p className="my-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Other featured</p>}
              <div className={`flex items-center gap-3 rounded-xl border p-3 ${i < TOP ? "border-amber-400 bg-amber-50/70" : "bg-white/70"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < TOP ? "bg-amber-400 text-amber-950" : "bg-slate-200"}`}>{i + 1}</span>
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{c.name}</div>
                  <div className="truncate text-xs text-slate-500">{[c.city, c.state].filter(Boolean).join(", ")}</div></div>
                <button className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">▲</button>
                <button className={btn} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down">▼</button>
                <button className={`${btn} text-red-700`} onClick={() => remove(i)}>Remove</button>
              </div></li>))}</ol>
        </section>
        <section className="glass rounded-2xl border p-4">
          <h2 className="mb-3 font-semibold">Add a company</h2>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search approved companies" className="mb-3 w-full rounded-lg border px-3 py-2 text-sm" />
          <ul className="space-y-2">{results.map(r => {
            const on = list.some(x => x.id === r.id);
            return (<li key={r.id} className="flex items-center gap-3 rounded-xl border bg-white/70 p-3">
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{r.name}</div>
                <div className="truncate text-xs text-slate-500">{[r.city, r.state].filter(Boolean).join(", ")}</div></div>
              <button className={btn} disabled={on || list.length >= MAX} onClick={() => add(r)}>{on ? "Added" : "Add"}</button></li>);
          })}{results.length === 0 && <li className="py-4 text-center text-sm text-slate-500">No approved companies found.</li>}</ul>
        </section>
      </div>
    </div>);
}
