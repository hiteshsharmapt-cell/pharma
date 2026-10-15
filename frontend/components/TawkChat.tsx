"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { tellChat, KEY_VISITOR } from "@/components/ContactPopup";

// Tawk.to live chat. Set NEXT_PUBLIC_TAWK_PROPERTY_ID and NEXT_PUBLIC_TAWK_WIDGET_ID on Vercel (then redeploy).
// If either is missing nothing loads. Uses the same plain <script> injection as Tawk's own embed snippet.
const PROPERTY = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID;
const WIDGET = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || "default";

declare global { interface Window { Tawk_API?: any; Tawk_LoadStart?: Date } }

export default function TawkChat() {
  const path = usePathname();
  const hidden = path.startsWith("/admin");  // staff don't need the visitor chat bubble

  useEffect(() => {
    if (!PROPERTY) return;
    const apply = () => {
      const api = window.Tawk_API; if (api?.showWidget) (hidden ? api.hideWidget() : api.showWidget());
      try { const v = JSON.parse(localStorage.getItem(KEY_VISITOR) || "null"); if (v?.phone) tellChat(v); } catch {}  // let staff see who is chatting
    };
    if (document.getElementById("tawk-chat")) { apply(); return; }
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();
    window.Tawk_API.onLoad = apply;
    const start = () => {
      const s = document.createElement("script");
      s.id = "tawk-chat"; s.async = true; s.charset = "UTF-8"; s.setAttribute("crossorigin", "*");
      s.src = `https://embed.tawk.to/${PROPERTY}/${WIDGET}`;
      document.body.appendChild(s);
    };
    // Wait until the page is idle so chat never slows the first paint.
    const ric = (window as any).requestIdleCallback;
    ric ? ric(start, { timeout: 3000 }) : setTimeout(start, 1500);
  }, [hidden]);

  return null;
}
