"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO_SRC, SITE_NAME } from "@/lib/brand";
import HeroSearch from "@/components/HeroSearch";

// Logo directly under the fixed top bar; on the homepage the search box sits right beside it. Scrolls with the page. Centred on phones, left-aligned beside the search on larger screens.
export default function LogoRow() {
  const home = usePathname() === "/";
  return (
    <div className="relative z-20 mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 pb-3 pt-1 md:flex-row md:items-center md:gap-8">
      {/* White badge behind the logo so it stays clearly visible on the dark background. */}
      <Link href="/" className="logo-badge inline-flex shrink-0 items-center gap-3 rounded-2xl px-4 py-2 font-display text-xl font-semibold text-slate-900 shadow-lg shadow-black/30"
        style={{ background: "rgba(255,255,255,0.96)" }}>
        {/* Logo size: h-14 on phones, 80px on larger screens. Change the h-... values to resize. */}
        <img src={LOGO_SRC} alt={SITE_NAME} className="h-14 w-auto object-contain sm:h-20" />
        {SITE_NAME}
      </Link>
      {home && <div className="min-w-0 w-full flex-1"><HeroSearch /></div>}
    </div>);
}
