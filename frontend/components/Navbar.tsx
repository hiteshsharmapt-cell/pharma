"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, homeFor } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { CONTACT_PHONE, CONTACT_TEL } from "@/lib/contact";

// Only this slim bar is fixed to the top of the screen. The logo and search sit below it (see LogoRow) and scroll away.
// Transparent at the top of the page; once you scroll it gets a dark frosted background so the text stays readable.
export default function Navbar() {
  const { user, logout } = useAuth();
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [spacer, setSpacer] = useState(36);
  const link = "nav-link";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the spacer exactly as tall as the bar (it can wrap to two lines on small phones) so content never hides under it.
  useEffect(() => {
    const measure = () => { if (ref.current) setSpacer(ref.current.offsetHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [user]);

  return (<>
    <header ref={ref} className={`fixed inset-x-0 top-0 z-40 transition-colors duration-200 ${scrolled
      ? "nav-solid shadow-[0_4px_18px_rgba(0,0,0,0.25)] backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-x-4 gap-y-1 px-4 py-1.5 text-sm font-medium">
        <Link href="/post-requirement" className="nav-pill rounded-full border px-3 py-0.5">Post Requirement</Link>
        <a href={`tel:${CONTACT_TEL}`} className={link}>
          <span aria-hidden>📞</span> <span className="hidden sm:inline">Contact Us: </span>{CONTACT_PHONE}
        </a>
        <ThemeToggle />
        {user ? (<>
          <Link href={homeFor(user.role)} className={link}>Dashboard</Link>
          <button onClick={logout} className={link}>Logout</button></>) : (<>
          <Link href="/login" className={link}>Login</Link>
          <Link href="/register" className="bg-brand-600 rounded-full px-4 py-0.5 font-semibold text-white">Join Free</Link></>)}
      </div>
    </header>
    <div aria-hidden style={{ height: spacer }} />
  </>);
}
