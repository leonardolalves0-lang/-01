import { lerSessao, responder } from "./_lib.js";

export default function handler(req, res) {
  const s = lerSessao(req);
  responder(res, 200, s ? { ok: true, usuario: s.u } : { ok: false });
}
