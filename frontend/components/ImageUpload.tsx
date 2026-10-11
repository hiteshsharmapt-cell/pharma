"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { cdn } from "@/lib/img";

const MAX = 2 * 1024 * 1024;
/** Thumbnail + Upload/Remove buttons. `path` is the API endpoint (PUT uploads, DELETE removes). */
export default function ImageUpload({ src, path, field, onChange, label = "Image", size = 64, round = false }: {
  src?: string | null; path: string; field: "logo_url" | "image_url"; onChange: (url: string | null) => void;
  label?: string; size?: number; round?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const pick = async (f?: File) => {
    if (!f) return; setErr("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setErr("Use a JPG, PNG or WebP image.");
    if (f.size > MAX) return setErr("Image must be under 2 MB.");
    setBusy(true);
    try { const r = await api<Record<string, string | null>>(path, { method: "PUT", body: f, headers: { "Content-Type": f.type } }); onChange(r[field]); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const remove = async () => {
    if (!window.confirm(`Remove this ${label.toLowerCase()}?`)) return; setBusy(true); setErr("");
    try { await api(path, { method: "DELETE" }); onChange(null); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const url = cdn(src, size * 3);
  return (
    <div className="flex items-center gap-3">
      <div style={{ width: size, height: size }} className={`flex shrink-0 items-center justify-center overflow-hidden border bg-slate-50 text-xs text-slate-400 ${round ? "rounded-full" : "rounded-lg"}`}>
        {url ? <img src={url} alt={label} className="h-full w-full object-contain" /> : "No image"}</div>
      <div className="text-xs">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => pick(e.target.files?.[0])} />
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded border border-teal-300 px-2.5 py-1 font-semibold text-teal-800 disabled:opacity-50">{busy ? "Working…" : src ? "Replace" : `Upload ${label.toLowerCase()}`}</button>
          {src && <button type="button" disabled={busy} onClick={remove} className="rounded border border-red-300 px-2.5 py-1 font-semibold text-red-700 disabled:opacity-50">Remove</button>}
        </div>
        <p className="mt-1 text-slate-500">JPG, PNG or WebP, max 2 MB</p>
        {err && <p className="mt-1 text-red-700">{err}</p>}
      </div>
    </div>);
}
