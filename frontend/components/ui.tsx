import { ButtonHTMLAttributes, forwardRef, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Button({ variant = "primary", loading, className = "", children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline"; loading?: boolean }) {
  const styles = variant === "primary" ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 bg-white hover:bg-slate-50";
  return <button {...p} disabled={p.disabled || loading}
    className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${styles} ${className}`}>
    {loading ? "Please wait…" : children}</button>;
}

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
type Base = { label: string; error?: string };

export const Input = forwardRef<HTMLInputElement, Base & InputHTMLAttributes<HTMLInputElement>>(
  ({ label, error, ...p }, ref) => (
    <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span>
      <input ref={ref} {...p} className={field} />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, Base & SelectHTMLAttributes<HTMLSelectElement>>(
  ({ label, error, children, ...p }, ref) => (
    <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span>
      <select ref={ref} {...p} className={field}>{children}</select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>));
Select.displayName = "Select";

export const Alert = ({ children }: { children: React.ReactNode }) =>
  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{children}</div>;
