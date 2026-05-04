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
const getModel = () => {
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    generationConfig: {
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
      topP: 0.8,
      topK: 40,
      maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '8192', 10),
      responseMimeType: 'application/json',
    },
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

module.exports = { getModel, testConnection };
