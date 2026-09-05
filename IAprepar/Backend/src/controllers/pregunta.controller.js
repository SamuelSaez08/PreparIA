'use strict';

/**
 * RF-04 — Carga y mantenimiento manual del banco de preguntas.
 * Complementa la generación con IA: aquí el administrador corrige, ajusta
 * la respuesta correcta o retira una pregunta mal formulada.
 */

const db = require('../config/db');
const logger = require('../utils/logger');
const preguntaRepo = require('../repositories/pregunta.repo');
const { ok, created, fail } = require('../utils/response');

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F'];

const _validarOpciones = (opciones) => {
  const correctas = opciones.filter(o => o.es_correcta === true || o.es_correcta === 'true');
  if (correctas.length !== 1) {
    return 'La pregunta debe tener exactamente una opción correcta.';
  }
  return null;
};

const listar = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit || '25', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const filtros = {
      idNodo:     req.query.nodo     ? parseInt(req.query.nodo, 10)   : null,
      idNivel:    req.query.nivel    ? parseInt(req.query.nivel, 10)  : null,
      dificultad: req.query.dificultad || null,
      busqueda:   req.query.q ? String(req.query.q).trim() : null,
    };

    const [{ rows }, { rows: totalRows }] = await Promise.all([
      preguntaRepo.listar({ ...filtros, limit, offset }),
      preguntaRepo.contar(filtros),
    ]);

    return ok(res, 'Preguntas obtenidas.', rows, { total: totalRows[0].total, limit, offset });
  } catch (err) { next(err); }
};

const detalle = async (req, res, next) => {
  try {
    const { rows } = await preguntaRepo.findById(req.params.id);
    if (!rows.length) return fail(res, 'Pregunta no encontrada.', 404);
    return ok(res, 'Pregunta obtenida.', rows[0]);
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    const { id_nodo, id_nivel, enunciado, texto_base, dificultad, explicacion, opciones } = req.body;

    const errorOpciones = _validarOpciones(opciones);
    if (errorOpciones) return fail(res, errorOpciones, 400);

    const id = await db.transaction(async (client) => {
      const { rows } = await preguntaRepo.insertPregunta(client, {
        idNodo:      id_nodo,
        idNivel:     id_nivel,
        enunciado:   enunciado.trim(),
        textoBase:   texto_base,
        dificultad,
        explicacion,
        creadoPor:   req.user.id_usuario,
      });

      const idPregunta = rows[0].id;

      for (let i = 0; i < opciones.length; i++) {
        await preguntaRepo.insertOpcion(client, {
          idPregunta,
          letra:      LETRAS[i],
          texto:      String(opciones[i].texto).trim(),
          esCorrecta: opciones[i].es_correcta === true || opciones[i].es_correcta === 'true',
        });
      }

      return idPregunta;
    });

    const { rows: creada } = await preguntaRepo.findById(id);
    logger.info(`Pregunta ${id} creada por el administrador ${req.user.id_usuario}`);
    return created(res, 'Pregunta creada.', creada[0]);
  } catch (err) {
    if (err.code === '23503') return fail(res, 'El nodo o el nivel indicados no existen.', 400);
    next(err);
  }
};

const editar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { enunciado, texto_base, dificultad, explicacion, opciones } = req.body;

    const { rows: existe } = await preguntaRepo.findById(id);
    if (!existe.length) return fail(res, 'Pregunta no encontrada.', 404);

    if (opciones) {
      const errorOpciones = _validarOpciones(opciones);
      if (errorOpciones) return fail(res, errorOpciones, 400);
    }

    await db.transaction(async (client) => {
      await preguntaRepo.updatePregunta(client, id, {
        enunciado, textoBase: texto_base, dificultad, explicacion,
      });

      if (opciones) {
        await preguntaRepo.deleteOpciones(client, id);
        for (let i = 0; i < opciones.length; i++) {
          await preguntaRepo.insertOpcion(client, {
            idPregunta: id,
            letra:      LETRAS[i],
            texto:      String(opciones[i].texto).trim(),
            esCorrecta: opciones[i].es_correcta === true || opciones[i].es_correcta === 'true',
          });
        }
      }
    });

    const { rows } = await preguntaRepo.findById(id);
    logger.info(`Pregunta ${id} editada por el administrador ${req.user.id_usuario}`);
    return ok(res, 'Pregunta actualizada.', rows[0]);
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await preguntaRepo.desactivar(id);
    if (!rows.length) return fail(res, 'Pregunta no encontrada.', 404);

    const { rows: enUso } = await preguntaRepo.estaEnSimulacro(id);
    logger.info(`Pregunta ${id} retirada por el administrador ${req.user.id_usuario}`);

    return ok(
      res,
      enUso.length
        ? 'Pregunta retirada. Seguirá visible en los simulacros ya realizados para no alterar el historial.'
        : 'Pregunta retirada.',
      rows[0]
    );
  } catch (err) { next(err); }
};

module.exports = { listar, detalle, crear, editar, eliminar };
