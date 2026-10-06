import "./globals.css";
import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Scene from "@/components/Scene";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PharmaConnect — Pharmaceutical Companies, Products & Opportunities", template: "%s | PharmaConnect" },
  description: "Connect pharmaceutical buyers and suppliers. Find companies, products and PCD franchise opportunities across India.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${sora.variable} ${manrope.variable} font-sans antialiased`}>
        <Scene />
        <AuthProvider>
          <Navbar />
          <main className="relative">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>);
}
