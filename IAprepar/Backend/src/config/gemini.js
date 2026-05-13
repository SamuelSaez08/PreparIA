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
  const modelName = modelOverride || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
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

const MODELOS_FALLBACK = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

const getModelConFallback = () => {
  const modeloPrincipal = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  return [
    modeloPrincipal,
    ...MODELOS_FALLBACK.filter(m => m !== modeloPrincipal)
  ];
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

module.exports = { getModel, getModelConFallback, testConnection };
