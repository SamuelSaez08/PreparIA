'use strict';

/**
 * Caso de uso 4.7 — Generar reportes.
 * El administrador solicita un reporte, el sistema compila la información
 * registrada y la devuelve en JSON o la descarga en CSV (abrible en Excel y
 * listo para imprimir a PDF desde el panel).
 */

const logger = require('../utils/logger');
const reporteRepo = require('../repositories/reporte.repo');
const { ok, fail } = require('../utils/response');

const TIPOS_VALIDOS = ['progreso_general', 'por_materia', 'simulacros', 'usuarios_activos'];

// ── Utilidades CSV ───────────────────────────────────────────────────────────

const _celda = (valor) => {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor).replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return /[";,]/.test(texto) ? `"${texto}"` : texto;
};

const _aCsv = (filas, columnas) => {
  const cabecera = columnas.map(c => _celda(c.titulo)).join(';');
  const cuerpo = filas.map(f => columnas.map(c => _celda(f[c.campo])).join(';'));
  // BOM para que Excel en Windows reconozca los acentos.
  return '﻿' + [cabecera, ...cuerpo].join('\r\n');
};

const COLUMNAS_ESTUDIANTES = [
  { campo: 'nombre',         titulo: 'Nombre' },
  { campo: 'apellido',       titulo: 'Apellido' },
  { campo: 'email',          titulo: 'Correo' },
  { campo: 'grado',          titulo: 'Grado' },
  { campo: 'institucion',    titulo: 'Institución' },
  { campo: 'simulacros',     titulo: 'Simulacros completados' },
  { campo: 'promedio',       titulo: 'Promedio (%)' },
  { campo: 'mejor',          titulo: 'Mejor puntaje (%)' },
  { campo: 'ultimo_intento', titulo: 'Último intento' },
];

// ── Generación ───────────────────────────────────────────────────────────────

const generar = async (req, res, next) => {
  try {
    const tipo    = req.query.tipo || 'progreso_general';
    const desde   = req.query.desde || null;
    const hasta   = req.query.hasta || null;
    const formato = (req.query.formato || 'json').toLowerCase();

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return fail(res, `Tipo de reporte inválido. Usa uno de: ${TIPOS_VALIDOS.join(', ')}.`, 400);
    }
    if (!['json', 'csv'].includes(formato)) {
      return fail(res, 'Formato inválido. Usa json o csv.', 400);
    }

    const [
      { rows: resumen },
      { rows: estudiantes },
      { rows: materias },
      { rows: falladas },
    ] = await Promise.all([
      reporteRepo.resumenGeneral(desde, hasta),
      reporteRepo.rendimientoPorEstudiante(desde, hasta),
      reporteRepo.rendimientoPorMateria(desde, hasta),
      reporteRepo.preguntasMasFalladas(desde, hasta),
    ]);

    const datos = {
      tipo,
      periodo: { desde: desde || 'inicio', hasta: hasta || 'hoy' },
      generado_en: new Date().toISOString(),
      resumen: resumen[0],
      rendimiento_por_estudiante: estudiantes,
      rendimiento_por_materia: materias,
      preguntas_mas_falladas: falladas,
    };

    // Se archiva el reporte para dejar traza de quién lo pidió y cuándo.
    let registro = null;
    try {
      const { rows } = await reporteRepo.guardarReporte({
        idUsuario:   req.user.id_usuario,
        tipo,
        descripcion: `Reporte ${tipo} (${datos.periodo.desde} → ${datos.periodo.hasta})`,
        desde, hasta,
        datos,
      });
      registro = rows[0];
    } catch (err) {
      logger.warn(`No se pudo archivar el reporte: ${err.message}`);
    }

    if (formato === 'csv') {
      const nombreArchivo = `preparia_${tipo}_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      return res.send(_aCsv(estudiantes, COLUMNAS_ESTUDIANTES));
    }

    logger.info(`Reporte ${tipo} generado por el administrador ${req.user.id_usuario}`);
    return ok(res, 'Reporte generado.', datos, registro ? { id_reporte: registro.id } : null);
  } catch (err) { next(err); }
};

const historial = async (_req, res, next) => {
  try {
    const { rows } = await reporteRepo.listarReportes(20);
    return ok(res, 'Historial de reportes obtenido.', rows);
  } catch (err) { next(err); }
};

const detalle = async (req, res, next) => {
  try {
    const { rows } = await reporteRepo.findReporte(req.params.id);
    if (!rows.length) return fail(res, 'Reporte no encontrado.', 404);
    return ok(res, 'Reporte obtenido.', rows[0]);
  } catch (err) { next(err); }
};

module.exports = { generar, historial, detalle };
