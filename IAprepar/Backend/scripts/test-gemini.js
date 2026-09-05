'use strict';
require('dotenv').config();

const { getModel, testConnection } = require('../src/config/gemini');

async function testGemini() {
  console.log('Testing Gemini connection with model default...');
  const ok = await testConnection();
  console.log('Test connection result:', ok ? '✅ ÉXITO' : '❌ FALLÓ');

  if (!ok) {
    try {
      const model = getModel('gemini-2.5-flash');
      console.log('Testing gemini-2.5-flash directly...');
      const res = await model.generateContent('Responde solo { "status": "ok" }');
      console.log('Response text:', res.response.text());
    } catch (err) {
      console.error('Direct test error:', err);
    }
  }
}

testGemini();
