"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO_SRC, SITE_NAME } from "@/lib/brand";
import HeroSearch from "@/components/HeroSearch";

// Logo directly under the fixed top bar; on the homepage the search box sits right beside it. Scrolls with the page.
export default function LogoRow() {
  const home = usePathname() === "/";
  return (
    <div className="relative z-20 mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-3 pt-1 md:flex-row md:items-center md:gap-8">
      <Link href="/" className="inline-flex shrink-0 items-center gap-3 font-display text-xl font-semibold text-white">
        {/* Logo size: h-16 on phones, 90px on larger screens. Change the h-... values to resize. */}
        <img src={LOGO_SRC} alt={SITE_NAME} className="h-16 w-auto object-contain sm:h-[90px]" />
        {SITE_NAME}
      </Link>
      {home && <div className="min-w-0 flex-1"><HeroSearch /></div>}
    </div>);
}
