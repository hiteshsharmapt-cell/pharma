"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuth, homeFor, User } from "@/lib/auth";
import { Alert, Button, Input, Select } from "@/components/ui";

type Loc = { id: number; name: string; type: "STATE" | "CITY"; parent_id: number | null };
const TYPES = ["Manufacturer", "Third Party Manufacturer", "PCD Franchise Company", "Distributor", "Wholesaler"];
const FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Ointment / Cream", "Drops", "Powder", "Gel", "Other"];
const MAX_PRODUCTS = 10;

const schema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  password: z.string().min(8, "Minimum 8 characters"),
  company_name: z.string().min(2, "Enter company name"),
  state_id: z.coerce.number().min(1, "Select a state"),
  city_id: z.coerce.number().min(1, "Select a city"),
  business_type: z.string().min(1, "Select business type"),
  products: z.array(z.object({
    name: z.string().min(2, "Enter product name"),
    composition: z.string().optional(),
    dosage_form: z.string().optional(),
    pack_size: z.string().optional(),
  })),
});
type Form = z.infer<typeof schema>;

export default function Register() {
  const router = useRouter(); const { setSession } = useAuth();
  const [locs, setLocs] = useState<Loc[]>([]); const [error, setError] = useState("");
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) as any, defaultValues: { products: [] } });
  const { fields, append, remove } = useFieldArray({ control, name: "products" });
  useEffect(() => { api<Loc[]>("/api/locations").then(setLocs).catch(() => setError("Could not load locations")); }, []);
  const stateId = Number(watch("state_id"));

  const onSubmit = async (d: Form) => {
    setError("");
    const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
    const products = d.products.map(p => ({ name: p.name.trim(), composition: clean(p.composition),
      dosage_form: clean(p.dosage_form), pack_size: clean(p.pack_size) }));
    try {
      const r = await api<{ access_token: string; user: User }>("/api/auth/register", { method: "POST", json: { ...d, products } });
      setSession(r.access_token, r.user); router.push(homeFor(r.user.role));
    } catch (e: any) { setError(e.message); }
  };
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Register as a Supplier</h1>
      <p className="mb-6 text-sm text-slate-500">Your company and products go live after admin approval.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 rounded-xl border bg-white p-6 sm:grid-cols-2" noValidate>
        {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
        <Input label="Your name" {...register("name")} error={errors.name?.message} />
        <Input label="Mobile" inputMode="numeric" {...register("mobile")} error={errors.mobile?.message} />
        <Input label="Email" type="email" {...register("email")} error={errors.email?.message} />
        <Input label="Password" type="password" {...register("password")} error={errors.password?.message} />
        <div className="sm:col-span-2"><Input label="Company name" {...register("company_name")} error={errors.company_name?.message} /></div>
        <Select label="State" {...register("state_id")} error={errors.state_id?.message}>
          <option value="">Select state</option>
          {locs.filter(l => l.type === "STATE").map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
        <Select label="City" {...register("city_id")} error={errors.city_id?.message}>
          <option value="">Select city</option>
          {locs.filter(l => l.type === "CITY" && l.parent_id === stateId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
        <div className="sm:col-span-2">
          <Select label="Business type" {...register("business_type")} error={errors.business_type?.message}>
            <option value="">Select type</option>{TYPES.map(t => <option key={t}>{t}</option>)}
          </Select></div>

        <div className="space-y-3 sm:col-span-2">
          <div className="flex items-center justify-between">
            <div><h2 className="font-semibold">Products <span className="text-xs font-normal text-slate-500">(optional)</span></h2>
              <p className="text-xs text-slate-500">Add up to {MAX_PRODUCTS} now. You can submit more later.</p></div>
            <button type="button" disabled={fields.length >= MAX_PRODUCTS}
              onClick={() => append({ name: "", composition: "", dosage_form: "", pack_size: "" })}
              className="rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">+ Add product</button>
          </div>
          {fields.map((f, i) => (
            <div key={f.id} className="grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-2">
              <div className="flex items-center justify-between sm:col-span-2">
                <span className="text-sm font-semibold">Product {i + 1}</span>
                <button type="button" onClick={() => remove(i)} className="text-xs font-semibold text-red-600">Remove</button>
              </div>
              <div className="sm:col-span-2"><Input label="Product name" {...register(`products.${i}.name`)} error={errors.products?.[i]?.name?.message} /></div>
              <div className="sm:col-span-2"><Input label="Composition" {...register(`products.${i}.composition`)} /></div>
              <Select label="Dosage form" {...register(`products.${i}.dosage_form`)}>
                <option value="">Select</option>{FORMS.map(x => <option key={x}>{x}</option>)}
              </Select>
              <Input label="Pack size" placeholder="e.g. 10x10" {...register(`products.${i}.pack_size`)} />
            </div>))}
        </div>
        <Button type="submit" loading={isSubmitting} className="sm:col-span-2">Create account</Button>
      </form>
    </div>);
}
