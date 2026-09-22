'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'tu_api_key_aqui') {
  logger.warn('GEMINI_API_KEY no está configurada o es inválida en el archivo .env. La generación de IA fallará.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

/**
 * Retorna el modelo de Gemini configurado con los parámetros estrictos
 * para generación de JSON y sin filtros de seguridad.
 */
const getModel = (modelOverride = null) => {
  const modelName = modelOverride || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const is25 = modelName.includes('gemini-2.5');

  // gemini-2.5-x no acepta topK/topP y requiere thinkingConfig para deshabilitar thinking
  const generationConfig = {
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '8192', 10),
    responseMimeType: 'application/json',
    ...(is25
      ? { thinkingConfig: { thinkingBudget: 0 } }
      : { topP: 0.8, topK: 40 }),
  };

  logger.info(`[gemini] Modelo activo: ${modelName}`);

  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  });
};

// Modelos de respaldo, en orden. gemini-2.0-flash ya fue retirado por Google
// y gemini-2.5-flash-lite no está disponible para proyectos nuevos (responde
// 404), así que ya no sirven como respaldo. Se pueden cambiar sin tocar el
// código con GEMINI_FALLBACK_MODELS="modelo1,modelo2".
const MODELOS_FALLBACK = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash-lite,gemini-3.5-flash')
  .split(',')
  .map(m => m.trim())
  .filter(Boolean);

// Modelos que Google respondió como inexistentes (404) mientras corre este
// proceso. No se vuelven a intentar hasta el siguiente despliegue.
const modelosNoDisponibles = new Set();
const marcarModeloNoDisponible = (nombre) => {
  if (!modelosNoDisponibles.has(nombre)) {
    modelosNoDisponibles.add(nombre);
    logger.warn(`[gemini] El modelo ${nombre} no está disponible (404); se deja de usar.`);
  }
};

const getModelConFallback = () => {
  const modeloPrincipal = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const lista = [
    modeloPrincipal,
    ...MODELOS_FALLBACK.filter(m => m !== modeloPrincipal)
  ];
  const vivos = lista.filter(m => !modelosNoDisponibles.has(m));
  // Si por algún motivo se marcaron todos, se vuelve a intentar con el principal.
  return vivos.length ? vivos : [modeloPrincipal];
};

/**
 * Verifica la conexión enviando un prompt súper corto
 */
const testConnection = async () => {
  try {
    const model = getModel();
    const result = await model.generateContent('Responde con un JSON válido que contenga { "ok": true }');
    const text = result.response.text();
    // Parse it to ensure it's valid JSON
    JSON.parse(text);
    return true;
  } catch (err) {
    logger.error(`Error enviando Ping a Gemini: ${err.message}`);
    return false;
  }
};

module.exports = { getModel, getModelConFallback, marcarModeloNoDisponible, testConnection };
