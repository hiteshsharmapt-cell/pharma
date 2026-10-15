import Link from "next/link";
export default function AdminNav() {
  return (
    <div className="mb-6 flex gap-4 border-b pb-3 text-sm font-semibold">
      <Link href="/admin/companies">Companies</Link>
      <Link href="/admin/featured">Featured</Link>
      <Link href="/admin/catalog">Catalogue</Link>
      <Link href="/admin/products">Products</Link>
      <Link href="/admin/requirements">Requirements</Link>
      <Link href="/admin/contacts">Contacts</Link>
    </div>);
}
