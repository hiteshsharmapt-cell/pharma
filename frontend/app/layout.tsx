import "./globals.css";
import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Scene from "@/components/Scene";
import TawkChat from "@/components/TawkChat";
import LogoRow from "@/components/LogoRow";
import ContactPopup from "@/components/ContactPopup";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "YesToPharma — Pharmaceutical Companies, Products & Opportunities", template: "%s | YesToPharma" },
  description: "Connect pharmaceutical buyers and suppliers. Find companies, products and PCD franchise opportunities across India.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before the page paints, so a light-theme visitor never sees a dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("yp_theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}` }} />
      </head>
      <body suppressHydrationWarning className={`${sora.variable} ${manrope.variable} font-sans antialiased`}>
        <Scene />
        <AuthProvider>
          <Navbar />
          <LogoRow />
          <main className="relative">{children}</main>
          <Footer />
          <TawkChat />
          <ContactPopup />
        </AuthProvider>
      </body>
    </html>);
}
