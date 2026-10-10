"use client";
import Link from "next/link";
import { useAuth, homeFor } from "@/lib/auth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const link = "text-black hover:text-teal-700";
  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-white/70 shadow-[0_6px_24px_rgba(4,36,48,0.18)] backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-black">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </span>
          PharmaConnect
        </Link>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
          <Link href="/find" className={link}>Find Manufacturers</Link>
          <Link href="/companies" className={link}>Companies</Link>
          <Link href="/products" className={link}>Products</Link>
          {user ? (<>
            <Link href={homeFor(user.role)} className={link}>Dashboard</Link>
            <button onClick={logout} className="text-black hover:text-teal-700">Logout</button></>) : (<>
            <Link href="/login" className={link}>Login</Link>
            <Link href="/register" className={link}>Register</Link></>)}
          <Link href="/post-requirement" className="bg-brand-600 rounded-full px-4 py-2 font-semibold text-white">Post Requirement</Link>
        </div>
      </nav>
    </header>);
}
