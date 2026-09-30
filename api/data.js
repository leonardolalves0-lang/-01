// Leitura e gravação dos dados do painel no Upstash Redis.
//   GET    /api/data                      -> { config, meses: { "2026-08": {...} } }
//   PUT    /api/data?doc=config/geral     -> grava os cadastros
//   PUT    /api/data?doc=meses/2026-08    -> grava um mês
//   DELETE /api/data?doc=meses/2026-08    -> apaga um mês
import { erroHttp, lerCorpo, lerSessao, redis, responder, tratarErro, PREFIXO } from "./_lib.js";
import { dadosIniciais } from "./_seed.js";

const K_CONFIG = `${PREFIXO}:config`;
const K_MESES = `${PREFIXO}:meses`;
const K_INICIADO = `${PREFIXO}:iniciado`;
const TAMANHO_MAX = 900 * 1024;

function alvo(doc) {
  if (doc === "config/geral") return { tipo: "config" };
  const m = /^meses\/(\d{4}-\d{2})$/.exec(doc || "");
  if (m) return { tipo: "mes", id: m[1] };
  throw erroHttp(400, "Documento inválido.");
}

async function lerTudo() {
  // Na primeira vez, grava os dados de partida (agosto/2026) que vieram do painel.
  if (!(await redis("GET", K_INICIADO))) {
    await redis("SET", K_CONFIG, JSON.stringify(dadosIniciais.config));
    for (const [id, mes] of Object.entries(dadosIniciais.meses)) await redis("HSET", K_MESES, id, JSON.stringify(mes));
    await redis("SET", K_INICIADO, new Date().toISOString());
  }
  const [config, lista] = await Promise.all([redis("GET", K_CONFIG), redis("HGETALL", K_MESES)]);
  const meses = {};
  for (let i = 0; i + 1 < (lista || []).length; i += 2) meses[lista[i]] = JSON.parse(lista[i + 1]);
  return { config: config ? JSON.parse(config) : null, meses };
}

export default async function handler(req, res) {
  try {
    if (!lerSessao(req)) return responder(res, 401, { erro: "Entre novamente." });

    if (req.method === "GET") return responder(res, 200, await lerTudo());

    const url = new URL(req.url, "http://x");
    const destino = alvo(url.searchParams.get("doc"));

    if (req.method === "PUT") {
      const dados = await lerCorpo(req);
      if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw erroHttp(400, "Conteúdo inválido.");
      const texto = JSON.stringify(dados);
      if (texto.length > TAMANHO_MAX) throw erroHttp(413, "Documento grande demais.");
      if (destino.tipo === "config") await redis("SET", K_CONFIG, texto);
      else await redis("HSET", K_MESES, destino.id, texto);
      return responder(res, 200, { ok: true });
    }

    if (req.method === "DELETE") {
      if (destino.tipo !== "mes") throw erroHttp(400, "Só meses podem ser apagados.");
      await redis("HDEL", K_MESES, destino.id);
      return responder(res, 200, { ok: true });
    }

    responder(res, 405, { erro: "Método não permitido." });
  } catch (e) {
    tratarErro(res, e);
  }
}
