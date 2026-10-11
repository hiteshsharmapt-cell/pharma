"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert, Button, Input, Select } from "@/components/ui";
import SupplierNav from "@/components/SupplierNav";
import ImageUpload from "@/components/ImageUpload";

type Product = { id: number; name: string; composition: string | null; dosage_form: string | null;
  pack_size: string | null; description: string | null; image_url?: string | null; status: string };
const FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Ointment / Cream", "Drops", "Powder", "Gel", "Other"];
const badge: Record<string, string> = { PENDING: "bg-amber-100 text-amber-800", APPROVED: "bg-emerald-100 text-emerald-800", REJECTED: "bg-red-100 text-red-800" };

const schema = z.object({
  name: z.string().min(2, "Enter product name"),
  composition: z.string().optional(), dosage_form: z.string().optional(),
  pack_size: z.string().optional(), description: z.string().max(3000).optional(),
});
type Form = z.infer<typeof schema>;
const empty: Form = { name: "", composition: "", dosage_form: "", pack_size: "", description: "" };

export default function SupplierProducts() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [items, setItems] = useState<Product[]>([]); const [busy, setBusy] = useState(true);
  const [error, setError] = useState(""); const [editing, setEditing] = useState<number | "new" | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: empty });

  useEffect(() => { if (!loading && (!user || user.role !== "SUPPLIER")) router.replace("/login"); }, [user, loading, router]);
  const load = useCallback(async () => {
    try { setItems(await api<Product[]>("/api/supplier/products")); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }, []);
  useEffect(() => { if (user?.role === "SUPPLIER") load(); }, [user, load]);

  const open = (p?: Product) => {
    setError(""); setEditing(p ? p.id : "new");
    reset(p ? { name: p.name, composition: p.composition ?? "", dosage_form: p.dosage_form ?? "", pack_size: p.pack_size ?? "", description: p.description ?? "" } : empty);
  };
  const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
  const onSubmit = async (d: Form) => {
    setError("");
    const body = { name: d.name.trim(), composition: clean(d.composition), dosage_form: clean(d.dosage_form),
      pack_size: clean(d.pack_size), description: clean(d.description) };
    try {
      if (editing === "new") await api("/api/supplier/products", { method: "POST", json: body });
      else await api(`/api/supplier/products/${editing}`, { method: "PUT", json: body });
      setEditing(null); load();
    } catch (e: any) { setError(e.message); }
  };
  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try { await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/supplier/products/${p.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("pm_token")}` } }).then(r => { if (!r.ok) throw new Error("Could not delete product"); });
      load(); } catch (e: any) { setError(e.message); }
  };
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SupplierNav />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Products</h1>
        {editing === null && <Button onClick={() => open()}>+ Add product</Button>}
      </div>
      <p className="mb-4 text-sm text-slate-500">New and edited products are reviewed by the admin before they appear on your public company page.</p>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {editing !== null && (
        <form onSubmit={handleSubmit(onSubmit)} className="mb-6 grid gap-4 rounded-xl border bg-white p-6 sm:grid-cols-2" noValidate>
          <h2 className="font-semibold sm:col-span-2">{editing === "new" ? "Add product" : "Edit product"}</h2>
          <div className="sm:col-span-2"><Input label="Product name" {...register("name")} error={errors.name?.message} /></div>
          <div className="sm:col-span-2"><Input label="Composition" {...register("composition")} /></div>
          <Select label="Dosage form" {...register("dosage_form")}><option value="">Select</option>{FORMS.map(f => <option key={f}>{f}</option>)}</Select>
          <Input label="Pack size" placeholder="e.g. 10x10" {...register("pack_size")} />
          <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-medium">Description</span>
            <textarea rows={3} {...register("description")} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100" /></label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={isSubmitting}>{editing === "new" ? "Submit for approval" : "Save changes"}</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>)}

      {busy ? <p className="p-6 text-center text-slate-500">Loading…</p> : items.length === 0 ?
        <p className="rounded-xl border bg-white p-10 text-center text-slate-500">No products yet. Click “Add product” to list your first one.</p> :
        <div className="space-y-3">{items.map(p => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
            <ImageUpload label="Photo" field="image_url" size={56} src={p.image_url} path={`/api/supplier/products/${p.id}/image`}
              onChange={u => setItems(xs => xs.map(x => x.id === p.id ? { ...x, image_url: u } : x))} />
            <div className="min-w-0 flex-1"><div className="font-semibold">{p.name}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${badge[p.status]}`}>{p.status}</span></div>
              <div className="text-sm text-slate-500">{[p.composition, p.dosage_form, p.pack_size].filter(Boolean).join(" · ") || "No details"}</div></div>
            <div className="flex gap-2">
              <button onClick={() => open(p)} className="rounded-lg border px-3 py-1.5 text-sm font-semibold">Edit</button>
              <button onClick={() => remove(p)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600">Delete</button>
            </div></div>))}</div>}
    </div>);
}
