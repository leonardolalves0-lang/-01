// Funções compartilhadas pelas rotas da API (arquivos com "_" não viram rotas na Vercel).
import crypto from "node:crypto";

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const PREFIXO = process.env.PAINEL_PREFIXO || "coco";
const HORAS_SESSAO = 12;

export function erroHttp(status, mensagem) {
  return Object.assign(new Error(mensagem), { status });
}

export function redisConfigurado() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

// Executa um comando no Upstash Redis pela API REST (sem dependências).
export async function redis(...comando) {
  if (!redisConfigurado()) {
    throw erroHttp(503, "Banco de dados não configurado. Conecte o Upstash Redis ao projeto na Vercel (Storage) e faça um novo deploy.");
  }
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(comando),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw erroHttp(502, "Erro no banco de dados: " + (j.error || r.status));
  return j.result;
}

function segredo() {
  return process.env.SESSION_SECRET || "";
}

function assinar(valor) {
  return crypto.createHmac("sha256", segredo()).update(valor).digest("base64url");
}

export function configuracaoLogin() {
  const faltando = ["PAINEL_USUARIO", "PAINEL_SENHA", "SESSION_SECRET"].filter((k) => !process.env[k]);
  if (faltando.length) return `Variáveis de ambiente ausentes na Vercel: ${faltando.join(", ")}.`;
  if (segredo().length < 32) return "SESSION_SECRET precisa ter pelo menos 32 caracteres.";
  return null;
}

export function criarSessao(res, usuario) {
  const exp = Date.now() + HORAS_SESSAO * 3600e3;
  const valor = Buffer.from(JSON.stringify({ u: usuario, exp })).toString("base64url");
  res.setHeader("Set-Cookie", `sessao=${valor}.${assinar(valor)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${HORAS_SESSAO * 3600}`);
}

export function encerrarSessao(res) {
  res.setHeader("Set-Cookie", "sessao=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
}

export function lerSessao(req) {
  const m = (req.headers.cookie || "").match(/(?:^|;\s*)sessao=([^;]+)/);
  if (!m || !segredo()) return null;
  const [valor, assinatura] = m[1].split(".");
  if (!valor || !assinatura) return null;
  const esperado = assinar(valor);
  if (assinatura.length !== esperado.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado))) return null;
  try {
    const s = JSON.parse(Buffer.from(valor, "base64url").toString());
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

// Comparação em tempo constante, para não vazar informação pelo tempo de resposta.
export function iguais(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function responder(res, status, dados) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(dados === undefined ? "" : JSON.stringify(dados));
}

export async function lerCorpo(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  let texto = "";
  for await (const parte of req) texto += parte;
  return texto ? JSON.parse(texto) : null;
}

export function tratarErro(res, e) {
  if (!e.status) console.error(e);
  responder(res, e.status || 500, { erro: e.status ? e.message : "Erro interno no servidor." });
}
