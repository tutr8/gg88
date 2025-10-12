export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key",
  );
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { TON_API_BASE, TON_API_KEY } = await import("../_config");
    const origin = TON_API_BASE.replace(/\/$/, "");
    const candidates = [
      `${origin}/v2/blockchain/info`,
      `${origin}/v2/blockchain/config`,
    ];

    const headers: Record<string, string> = { Accept: "application/json" };
    if (TON_API_KEY) {
      headers["Authorization"] = `Bearer ${TON_API_KEY}`;
      headers["X-API-Key"] = TON_API_KEY;
    }

    for (const url of candidates) {
      try {
        const r = await fetch(url, { headers });
        const contentType = r.headers.get("content-type") || "";
        const isJson = contentType.includes("application/json");

        if (!r.ok) {
          // try next candidate
          continue;
        }
        const data = isJson ? await r.json() : await r.text();
        return res.status(200).json({ ok: true, data, url });
      } catch (_) {
        // try next candidate
      }
    }

    return res
      .status(502)
      .json({ ok: false, error: "All TON API candidates failed", candidates });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
