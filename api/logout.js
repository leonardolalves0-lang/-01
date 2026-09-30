import { encerrarSessao, responder } from "./_lib.js";

export default function handler(req, res) {
  if (req.method !== "POST") return responder(res, 405, { erro: "Use POST." });
  encerrarSessao(res);
  responder(res, 200, { ok: true });
}
