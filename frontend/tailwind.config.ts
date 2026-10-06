import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { brand: { 50: "#ecfdf5", 100: "#ccfbf1", 600: "#0d9488", 700: "#115e59", 900: "#06141c" } },
      borderColor: { DEFAULT: "rgba(255,255,255,0.16)" },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-manrope)", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
