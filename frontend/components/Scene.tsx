"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js only runs in the browser, so it is loaded client-side, and only after the page is
// interactive (idle) so it never competes with first paint. Skipped on slow/data-saver connections.
const Background3D = dynamic(() => import("./Background3D"), { ssr: false });

export default function Scene() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const conn = (navigator as any).connection;
    if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "")) return;
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number);
    if (ric) { const id = ric(() => setReady(true), { timeout: 2500 }); return () => (window as any).cancelIdleCallback?.(id); }
    const id = window.setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(id);
  }, []);

  return (
    <div aria-hidden className="scene pointer-events-none fixed inset-0 -z-10 opacity-70 md:opacity-100">
      {ready && <Background3D />}
    </div>);
}
