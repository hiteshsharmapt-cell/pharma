"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";

// Tawk.to live chat. Set NEXT_PUBLIC_TAWK_PROPERTY_ID and NEXT_PUBLIC_TAWK_WIDGET_ID on Vercel; if either is missing, nothing loads.
const PROPERTY = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID;
const WIDGET = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID ?? "default";

export default function TawkChat() {
  const path = usePathname();
  if (!PROPERTY || path.startsWith("/admin")) return null;  // staff don't need the visitor chat bubble
  return <Script id="tawk-chat" strategy="lazyOnload"
    src={`https://embed.tawk.to/${PROPERTY}/${WIDGET}`} crossOrigin="anonymous" />;
}
