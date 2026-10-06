"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { Alert, Button, Input, Select } from "@/components/ui";

type Loc = { id: number; name: string; type: "STATE" | "CITY"; parent_id: number | null };
type Cat = { id: number; name: string };
const TYPES = ["PCD Pharma Franchise", "Third Party Manufacturing", "Pharma Products", "Distributor Requirement", "Other"] as const;
const YNA = ["Yes", "No", "Applied"] as const;

const schema = z.object({
  buyer_name: z.string().min(2, "Enter your name"),
  buyer_mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  buyer_email: z.string().email("Enter a valid email"),
  state_id: z.coerce.number().min(1, "Select a state"),
  city_id: z.coerce.number().min(1, "Select a city"),
  requirement_type: z.enum(TYPES, { errorMap: () => ({ message: "Select requirement type" }) }),
  category_id: z.string().optional(),
  drug_license_status: z.enum(YNA, { errorMap: () => ({ message: "Select an option" }) }),
  gst_status: z.enum(YNA, { errorMap: () => ({ message: "Select an option" }) }),
  message: z.string().min(10, "Please describe your requirement (min 10 characters)").max(2000),
  website: z.string().optional(), // honeypot
});
type Form = z.infer<typeof schema>;

export default function PostRequirement() {
  const [locs, setLocs] = useState<Loc[]>([]); const [cats, setCats] = useState<Cat[]>([]);
  const [error, setError] = useState(""); const [doneId, setDoneId] = useState<number | null>(null);
  const { register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) as any });
  useEffect(() => {
    api<Loc[]>("/api/locations").then(setLocs).catch(() => setError("Could not load locations. Please refresh."));
    api<Cat[]>("/api/categories").then(setCats).catch(() => {});
  }, []);
  // Preselect the category when arriving from a homepage category link (?category=ID)
  useEffect(() => {
    if (!cats.length) return;
    const c = new URLSearchParams(window.location.search).get("category");
    if (c && cats.some(x => String(x.id) === c)) setValue("category_id", c);
  }, [cats, setValue]);
  const stateId = Number(watch("state_id"));

  const onSubmit = async (d: Form) => {
    setError("");
    try {
      const r = await api<{ id: number }>("/api/requirements", { method: "POST",
        json: { ...d, category_id: d.category_id ? Number(d.category_id) : null, website: d.website ?? "" } });
      setDoneId(r.id); reset();
    } catch (e: any) { setError(e.message); }
  };

  if (doneId !== null) return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
      <h1 className="text-2xl font-bold">Requirement submitted</h1>
      <p className="mt-2 text-slate-600">Thank you! Our team will review it and connect you with suitable suppliers.</p>
      {doneId > 0 && <p className="mt-1 text-sm text-slate-500">Reference ID: #{doneId}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={() => setDoneId(null)} className="rounded-lg border px-5 py-2.5 font-semibold">Submit another</button>
        <Link href="/companies" className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white">Browse Companies</Link>
      </div>
    </div>);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Post Your Requirement</h1>
      <p className="mb-6 text-sm text-slate-500">Tell us what you need and we&apos;ll connect you with the right pharma suppliers.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 rounded-xl border bg-white p-6 sm:grid-cols-2" noValidate>
        {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
        <Input label="Your name" {...register("buyer_name")} error={errors.buyer_name?.message} />
        <Input label="Mobile" inputMode="numeric" {...register("buyer_mobile")} error={errors.buyer_mobile?.message} />
        <div className="sm:col-span-2"><Input label="Email" type="email" {...register("buyer_email")} error={errors.buyer_email?.message} /></div>
        <Select label="State" {...register("state_id")} error={errors.state_id?.message}>
          <option value="">Select state</option>
          {locs.filter(l => l.type === "STATE").map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
        <Select label="City" {...register("city_id")} error={errors.city_id?.message}>
          <option value="">Select city</option>
          {locs.filter(l => l.type === "CITY" && l.parent_id === stateId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
        <Select label="Requirement type" {...register("requirement_type")} error={errors.requirement_type?.message}>
          <option value="">Select type</option>{TYPES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Category (optional)" {...register("category_id")}>
          <option value="">Any category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select label="Drug licence" {...register("drug_license_status")} error={errors.drug_license_status?.message}>
          <option value="">Select</option>{YNA.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="GST" {...register("gst_status")} error={errors.gst_status?.message}>
          <option value="">Select</option>{YNA.map(t => <option key={t}>{t}</option>)}
        </Select>
        <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-medium">Requirement details</span>
          <textarea rows={4} {...register("message")} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100" />
          {errors.message && <span className="mt-1 block text-xs text-red-600">{errors.message.message}</span>}</label>
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" {...register("website")} />
        <Button type="submit" loading={isSubmitting} className="sm:col-span-2">Submit Requirement</Button>
      </form>
    </div>);
}
