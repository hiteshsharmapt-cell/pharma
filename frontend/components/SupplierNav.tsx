import Link from "next/link";
export default function SupplierNav() {
  return (
    <div className="mb-6 flex gap-4 border-b pb-3 text-sm font-semibold">
      <Link href="/supplier/dashboard">Dashboard</Link>
      <Link href="/supplier/products">Products</Link>
      <Link href="/supplier/capabilities">Capabilities</Link>
      <Link href="/supplier/leads">Leads</Link>
    </div>);
}
