import { configuracaoLogin, criarSessao, iguais, lerCorpo, redis, redisConfigurado, responder, tratarErro, PREFIXO, erroHttp } from "./_lib.js";

const LIMITE_TENTATIVAS = 8;
const JANELA_SEGUNDOS = 15 * 60;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return responder(res, 405, { erro: "Use POST." });
    const falta = configuracaoLogin();
    if (falta) throw erroHttp(500, falta);

    const ip = String(req.headers["x-forwarded-for"] || "local").split(",")[0].trim();
    const chave = `${PREFIXO}:tentativas:${ip}`;
    if (redisConfigurado()) {
      const n = Number(await redis("GET", chave)) || 0;
      if (n >= LIMITE_TENTATIVAS) return responder(res, 429, { erro: "Muitas tentativas erradas. Aguarde 15 minutos." });
    }

    const corpo = (await lerCorpo(req)) || {};
    const usuario = String(corpo.usuario || "").trim();
    const senha = String(corpo.senha || "");
    const ok = iguais(usuario.toLowerCase(), process.env.PAINEL_USUARIO.trim().toLowerCase()) & iguais(senha, process.env.PAINEL_SENHA);

    if (!ok) {
      if (redisConfigurado()) {
        await redis("INCR", chave);
        await redis("EXPIRE", chave, JANELA_SEGUNDOS);
      }
      await new Promise((r) => setTimeout(r, 500));
      return responder(res, 401, { erro: "Usuário ou senha incorretos." });
    }

    if (redisConfigurado()) await redis("DEL", chave);
    criarSessao(res, process.env.PAINEL_USUARIO.trim());
    responder(res, 200, { ok: true, usuario: process.env.PAINEL_USUARIO.trim() });
  } catch (e) {
    tratarErro(res, e);
  }
}
