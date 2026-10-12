"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, homeFor } from "@/lib/auth";
import { LOGO_SRC, SITE_NAME } from "@/lib/brand";
import { CONTACT_PHONE, CONTACT_TEL } from "@/lib/contact";

// Fixed header: slim bar (links) + logo underneath. Transparent at the top of the page; once you scroll it gets a
// dark frosted background and the logo shrinks so it uses less screen. A spacer keeps the page content from sliding under it.
export default function Navbar() {
  const { user, logout } = useAuth();
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [spacer, setSpacer] = useState(140);
  const link = "text-white/90 hover:text-white";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Measure the full-size header (only while at the top) so the spacer matches it exactly and the page never jumps.
  useEffect(() => {
    const measure = () => { if (window.scrollY <= 20 && ref.current) setSpacer(ref.current.offsetHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [user]);

  return (<>
    <header ref={ref} className={`fixed inset-x-0 top-0 z-40 transition-colors duration-200 ${scrolled
      ? "bg-[#06141c]/80 shadow-[0_6px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-x-4 gap-y-1 px-4 py-1.5 text-sm font-medium">
        <Link href="/post-requirement" className="rounded-full border border-white/50 px-3 py-0.5 text-white hover:bg-white/10">Post Requirement</Link>
        <a href={`tel:${CONTACT_TEL}`} className={link}>
          <span aria-hidden>📞</span> <span className="hidden sm:inline">Contact Us: </span>{CONTACT_PHONE}
        </a>
        {user ? (<>
          <Link href={homeFor(user.role)} className={link}>Dashboard</Link>
          <button onClick={logout} className={link}>Logout</button></>) : (<>
          <Link href="/login" className={link}>Login</Link>
          <Link href="/register" className="bg-brand-600 rounded-full px-4 py-0.5 font-semibold text-white">Join Free</Link></>)}
      </div>
      <div className={`mx-auto max-w-6xl px-4 transition-all duration-200 ${scrolled ? "pb-1 pt-0" : "pb-2 pt-1"}`}>
        <Link href="/" className="inline-flex items-center gap-3 font-display text-xl font-semibold text-white">
          {/* Logo size: 90px normally (64px on phones), 44px once scrolled. Change the h-... values below to resize. */}
          <img src={LOGO_SRC} alt={SITE_NAME}
            className={`w-auto object-contain transition-all duration-200 ${scrolled ? "h-11" : "h-16 sm:h-[90px]"}`} />
          <span className={scrolled ? "text-lg" : ""}>{SITE_NAME}</span>
        </Link>
      </div>
    </header>
    <div aria-hidden style={{ height: spacer }} />
  </>);
}
