import { Suspense } from "react";
import type { Metadata } from "next";
import FindSearch from "@/components/FindSearch";

export const metadata: Metadata = {
  title: "Find Pharma Manufacturers by Speciality or Product Category",
  description: "Search verified pharmaceutical manufacturers by speciality, dosage form and product category.",
};

export default function Find() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Find Manufacturers</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Search by therapeutic speciality, or by the dosage form and product category you need. Results show companies whose capability has been verified.</p>
      <Suspense fallback={<div className="glass h-40 animate-pulse rounded-2xl border" />}><FindSearch /></Suspense>
    </div>);
}
