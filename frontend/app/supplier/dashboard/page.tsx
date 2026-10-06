"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert } from "@/components/ui";
import SupplierNav from "@/components/SupplierNav";

type Stats = { company_name: string; company_status: string; total_products: number; approved_products: number; new_leads: number; total_leads: number };

export default function SupplierDashboard() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [s, setS] = useState<Stats | null>(null); const [error, setError] = useState("");
  useEffect(() => { if (!loading && (!user || user.role !== "SUPPLIER")) router.replace("/login"); }, [user, loading, router]);
  useEffect(() => { if (user?.role === "SUPPLIER") api<Stats>("/api/supplier/dashboard").then(setS).catch(e => setError(e.message)); }, [user]);
  if (loading || !user) return <p className="p-10 text-center text-slate-500">Loading…</p>;

  const cards = s ? [["Company Status", s.company_status], ["Total Products", s.total_products], ["Approved Products", s.approved_products],
    ["New Leads", s.new_leads], ["Total Leads", s.total_leads]] : [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SupplierNav />
      <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
      {s && <p className="text-slate-500">{s.company_name}</p>}
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {s?.company_status === "PENDING" && <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Your company is awaiting admin approval. Leads are available once it is approved.</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label as string} className="rounded-xl border bg-white p-5">
            <div className="text-xs uppercase text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold">{value}</div></div>))}
      </div>
      {s && s.new_leads > 0 && <Link href="/supplier/leads" className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white">View {s.new_leads} new lead{s.new_leads > 1 ? "s" : ""}</Link>}
    </div>);
}
