"use client";
import { useEffect, useState } from "react";

export const THEME_KEY = "yp_theme";

/** Sun/moon button. The saved choice is applied before first paint by the inline script in layout.tsx (no flash). */
export default function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.dataset.theme === "light"); }, []);

  const flip = () => {
    const next = !light;
    const root = document.documentElement;
    root.classList.add("theme-anim");                       // fade colours for a moment, then stop animating
    root.dataset.theme = next ? "light" : "dark";
    window.setTimeout(() => root.classList.remove("theme-anim"), 400);
    try { localStorage.setItem(THEME_KEY, next ? "light" : "dark"); } catch {}
    setLight(next);
  };

  return (
    <button type="button" onClick={flip} className="nav-pill flex h-7 w-7 items-center justify-center rounded-full text-base leading-none"
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"} title={light ? "Dark theme" : "Light theme"}>
      <span aria-hidden>{light ? "🌙" : "☀️"}</span>
    </button>);
}
