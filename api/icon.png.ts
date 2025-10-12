export default async function handler(_req: any, res: any) {
  try {
    const r = await fetch("https://via.placeholder.com/180.png");
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).end();
  }
}
