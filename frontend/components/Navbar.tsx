"use client";
import Link from "next/link";
import { useAuth, homeFor } from "@/lib/auth";
import { LOGO_SRC, SITE_NAME } from "@/lib/brand";
import { CONTACT_PHONE, CONTACT_TEL } from "@/lib/contact";

// Slim transparent top bar (scrolls away with the page) with the logo directly below it.
export default function Navbar() {
  const { user, logout } = useAuth();
  const link = "text-white/90 hover:text-white";
  return (
    <header className="relative z-20">
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
      <div className="mx-auto max-w-6xl px-4 pb-0 pt-0">
        <Link href="/" className="inline-flex items-center gap-3 font-display text-xl font-semibold text-white">
          <img src={LOGO_SRC} alt={SITE_NAME} style={{ height: 90 }} className="w-auto object-contain" />
          {SITE_NAME}
        </Link>
      </div>
    </header>);
}
