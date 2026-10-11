import Link from "next/link";
import { LOGO_SRC, SITE_NAME } from "@/lib/brand";

export default function Footer() {
  const link = "block text-black hover:text-teal-700";
  return (
    <footer className="mt-20 border-t border-white/70 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-8 px-4 py-10 text-sm">
        <div className="max-w-xs">
          <div className="flex items-center gap-2 font-display text-lg font-semibold text-black"><img src={LOGO_SRC} alt="" className="h-8 w-auto max-w-[120px] object-contain" />{SITE_NAME}</div>
          <p className="mt-2 text-black">A B2B marketplace connecting pharmaceutical buyers with manufacturers, franchise companies and suppliers across India.</p>
        </div>
        <div className="flex gap-12">
          <div className="space-y-2"><div className="font-semibold text-black">Explore</div>
            <Link href="/companies" className={link}>Companies</Link>
            <Link href="/products" className={link}>Products</Link>
            <Link href="/post-requirement" className={link}>Post Requirement</Link></div>
          <div className="space-y-2"><div className="font-semibold text-black">Suppliers</div>
            <Link href="/register" className={link}>List your company</Link>
            <Link href="/login" className={link}>Supplier login</Link></div>
        </div>
      </div>
      <div className="border-t border-slate-300/50 py-4 text-center text-xs text-black">© {new Date().getFullYear()} PharmaConnect. All rights reserved.</div>
    </footer>);
}
