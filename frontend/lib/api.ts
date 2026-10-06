const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const TOKEN_KEY = "pm_token";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.json !== undefined) { headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.json); }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = "Something went wrong. Please try again.";
    try {
      const d = (await res.json()).detail;
      msg = Array.isArray(d) ? d.map((e: any) => e.msg).join(", ") : d ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json();
}
