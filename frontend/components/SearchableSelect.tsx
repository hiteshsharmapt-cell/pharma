"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type Opt = { id: number; name: string; hint?: string };

/** A dropdown with a built-in search box. value = selected id, or "" for none. */
export default function SearchableSelect({ label, value, options, onChange, placeholder = "Select…", disabled = false, emptyText = "No matches" }: {
  label: string; value: number | ""; options: Opt[]; onChange: (id: number | "") => void;
  placeholder?: string; disabled?: boolean; emptyText?: string;
}) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null); const id = useId();
  const selected = options.find(o => o.id === value);
  const shown = useMemo(() => options.filter(o => o.name.toLowerCase().includes(q.trim().toLowerCase())), [options, q]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // The list panel below is solid white on purpose: the site-wide "bg-white" is frosted glass and would let the page show through.
  const pick = (v: number | "") => { onChange(v); setOpen(false); setQ(""); };
  return (
    <div ref={box} className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">{label}</label>
      <button id={id} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
        <span className={selected ? "text-slate-900" : "text-slate-500"}>{selected ? selected.name : placeholder}</span>
        <span aria-hidden className="ml-2 text-xs text-slate-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 shadow-xl"
          style={{ background: "#ffffff", backdropFilter: "none", WebkitBackdropFilter: "none" }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
            placeholder="Type to search…" aria-label={`Search ${label}`} className="w-full rounded-t-lg border-b px-3 py-2 text-sm outline-none" />
          <ul role="listbox" className="max-h-60 overflow-auto py-1 text-sm">
            <li><button type="button" onClick={() => pick("")} className="w-full px-3 py-2 text-left text-slate-500 hover:bg-slate-50">Any / clear</button></li>
            {shown.length === 0 && <li className="px-3 py-2 text-slate-500">{emptyText}</li>}
            {shown.map(o => (
              <li key={o.id}><button type="button" role="option" aria-selected={o.id === value} onClick={() => pick(o.id)}
                className={`flex w-full justify-between px-3 py-2 text-left text-slate-900 hover:bg-teal-50 ${o.id === value ? "bg-teal-50 font-semibold" : ""}`}>
                <span>{o.name}</span>{o.hint && <span className="ml-3 text-xs text-slate-500">{o.hint}</span>}</button></li>))}
          </ul>
        </div>)}
    </div>);
}
