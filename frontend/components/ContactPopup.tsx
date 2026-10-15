"use client";
import { FormEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

// Shows on every page load/reload (not on every in-site click): this flag resets whenever the page is reloaded.
let shownThisLoad = false;
export const KEY_VISITOR = "yp_visitor";
const SKIP = ["/admin", "/supplier", "/login", "/register", "/post-requirement"];

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

/** Tell the live-chat widget who this visitor is, so your team sees their name and number in the chat window. */
export function tellChat(v: { name: string; phone: string; requirement?: string }) {
  try { (window as any).Tawk_API?.setAttributes?.({ name: v.name, phone: v.phone, requirement: v.requirement ?? "" }, () => {}); } catch {}
}

export default function ContactPopup() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", phone: "", requirement: "", company_website: "" });

  useEffect(() => {  // returning visitor: pre-fill name and number so it takes one tap
    try { const v = JSON.parse(get(KEY_VISITOR) || "null"); if (v?.name) setF(x => ({ ...x, name: v.name, phone: v.phone || "" })); } catch {}
  }, []);

  useEffect(() => {
    if (SKIP.some(p => path.startsWith(p))) return;
    if (shownThisLoad) return;
    const t = setTimeout(() => { shownThisLoad = true; setOpen(true); }, 1800);
    return () => clearTimeout(t);
  }, [path]);

  const close = () => { setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); }, 220); };  // let the fade-out play first
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (f.name.trim().length < 2) return setErr("Please enter your name.");
    if (!/^(\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/.test(f.phone.trim())) return setErr("Enter a valid 10-digit mobile number.");
    if (f.requirement.trim().length < 2) return setErr("Please tell us your requirement.");
    setBusy(true);
    try {
      await api("/api/contacts", { method: "POST", json: { ...f, page: path } });
      const v = { name: f.name.trim(), phone: f.phone.trim(), requirement: f.requirement.trim() };
      set(KEY_VISITOR, JSON.stringify(v)); tellChat(v);
      setDone(true);
      setTimeout(close, 2500);
    } catch (e: any) { setErr(e.message || "Could not send. Please try again."); } finally { setBusy(false); }
  };

  if (!open) return null;
  const input = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900";
  return (
    <div className={`cp-backdrop ${closing ? "cp-out" : ""} fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4`} onClick={close}>
      <style>{`
        @keyframes cpFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cpRise { from { opacity: 0; transform: translateY(28px) scale(.95) } to { opacity: 1; transform: none } }
        @keyframes cpPop { 0% { transform: scale(.4); opacity: 0 } 70% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
        .cp-backdrop { animation: cpFade .35s ease-out both; backdrop-filter: blur(4px); }
        .cp-card { animation: cpRise .5s cubic-bezier(.16,1,.3,1) .05s both; }
        .cp-card form > *, .cp-card form .space-y-3 > * { animation: cpFade .5s ease-out both; }
        .cp-card form > :nth-child(1) { animation-delay: .25s } .cp-card form > :nth-child(2) { animation-delay: .32s }
        .cp-card form .space-y-3 > :nth-child(1) { animation-delay: .38s } .cp-card form .space-y-3 > :nth-child(2) { animation-delay: .45s }
        .cp-card form .space-y-3 > :nth-child(3) { animation-delay: .52s }
        .cp-card .text-slate-500 { color: #587480 } .cp-card .text-slate-600 { color: #2a4651 }
        .cp-tick { display: inline-block; animation: cpPop .5s ease-out both; }
        .cp-out { animation: none; opacity: 0; transition: opacity .22s ease-in; }
        .cp-out .cp-card { animation: none; opacity: 0; transform: translateY(14px) scale(.97); transition: all .22s ease-in; }
        @media (prefers-reduced-motion: reduce) { .cp-backdrop, .cp-card, .cp-card *, .cp-tick { animation: none !important; transition: none !important; } }
      `}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="cp-title" onClick={e => e.stopPropagation()}
        className="cp-card relative w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: "#fff" }}>
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 rounded-full px-2 text-2xl leading-none text-slate-500 hover:text-slate-900">×</button>
        {done ? (
          <div className="py-8 text-center">
            <div className="cp-tick text-4xl">✅</div>
            <h2 className="mt-3 font-display text-xl font-semibold text-slate-900">Thank you!</h2>
            <p className="mt-1 text-sm text-slate-600">We have your details and will contact you shortly.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 id="cp-title" className="font-display text-xl font-semibold text-slate-900">Tell us what you need</h2>
            <p className="mb-4 mt-1 text-sm text-slate-600">Leave your details and our team will get back to you.</p>
            <div className="space-y-3">
              <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Your name" autoComplete="name" autoFocus className={input} aria-label="Name" />
              <input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="Mobile number" inputMode="tel" autoComplete="tel" maxLength={16} className={input} aria-label="Mobile number" />
              <textarea value={f.requirement} onChange={e => setF({ ...f, requirement: e.target.value })} placeholder="Your requirement (product, quantity, location…)" rows={3} maxLength={2000} className={input} aria-label="Requirement" />
              {/* Honeypot: hidden from people, bots fill it in. */}
              <input value={f.company_website} onChange={e => setF({ ...f, company_website: e.target.value })} tabIndex={-1} autoComplete="off" aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} name="company_website" />
            </div>
            {err && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{err}</p>}
            <button disabled={busy} className="bg-brand-600 mt-4 w-full rounded-lg px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Sending…" : "Submit"}</button>
            <p className="mt-3 text-xs text-slate-500">By submitting, you agree to be contacted about your requirement.</p>
          </form>)}
      </div>
    </div>);
}
