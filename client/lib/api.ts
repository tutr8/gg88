export function apiUrl(path: string): string {
  const base = (import.meta as any).env?.VITE_API_BASE || "";
  const trimmedBase = String(base).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${p}`;
}
