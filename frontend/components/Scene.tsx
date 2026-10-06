"use client";
import dynamic from "next/dynamic";

// three.js only runs in the browser, so it is loaded client-side and never blocks first paint.
const Background3D = dynamic(() => import("./Background3D"), { ssr: false });

export default function Scene() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-70 md:opacity-100">
      <Background3D />
    </div>);
}
