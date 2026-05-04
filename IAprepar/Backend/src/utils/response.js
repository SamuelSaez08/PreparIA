'use strict';

/**
 * Respuestas JSON estandarizadas
 */
const ok = (res, mensaje, datos = null, meta = null, status = 200) => {
  const body = { ok: true, mensaje };
  if (datos !== null) body.datos = datos;
  if (meta  !== null) body.meta  = meta;
  return res.status(status).json(body);
};

const created = (res, mensaje, datos = null) => ok(res, mensaje, datos, null, 201);

const fail = (res, mensaje, status = 400, errores = null) => {
  const body = { ok: false, mensaje };
  if (errores) body.errores = errores;
  return res.status(status).json(body);
};

module.exports = { ok, created, fail };
