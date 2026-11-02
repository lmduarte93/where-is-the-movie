// Proxy do TMDB: guarda a chave no servidor (variável TMDB_TOKEN na Vercel)
// e só libera os endpoints que a página usa.
const ALLOWED = [
  /^\/search\/multi$/,
  /^\/movie\/\d+$/,
  /^\/collection\/\d+$/,
  /^\/(movie|tv)\/\d+\/watch\/providers$/,
  /^\/person\/\d+\/combined_credits$/
];

export default async function handler(req, res) {
  const token = process.env.TMDB_TOKEN;
  if (!token) return res.status(500).json({ error: "TMDB_TOKEN não configurado" });

  const { path, ...params } = req.query;
  if (typeof path !== "string" || !ALLOWED.some(r => r.test(path))) {
    return res.status(400).json({ error: "Endpoint não permitido" });
  }

  const url = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("language", "pt-BR");

  const isBearer = token.startsWith("eyJ");
  if (!isBearer) url.searchParams.set("api_key", token);

  try {
    const r = await fetch(url, {
      headers: isBearer ? { Authorization: "Bearer " + token, accept: "application/json" } : { accept: "application/json" }
    });
    const body = await r.text();
    // cache de 6h na borda: dados sempre recentes, sem estourar o limite da API
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ error: "Falha ao consultar o TMDB" });
  }
}
