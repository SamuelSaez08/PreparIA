'use strict';
require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const token = jwt.sign({ id_usuario: 1, rol: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

async function testBackendEndpoints() {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Origin': 'https://prepar-ia.vercel.app'
  };

  try {
    console.log('Testing GET https://preparia.onrender.com/api/v1/nodos/arbol/1 ...');
    const resArbol = await fetch('https://preparia.onrender.com/api/v1/nodos/arbol/1', { headers });
    console.log('Status Arbol:', resArbol.status);
    const textArbol = await resArbol.text();
    console.log('Body Arbol:', textArbol.substring(0, 300));

    console.log('\nTesting GET https://preparia.onrender.com/api/v1/simulacros ...');
    const resSim = await fetch('https://preparia.onrender.com/api/v1/simulacros', { headers });
    console.log('Status Simulacros:', resSim.status);
    const textSim = await resSim.text();
    console.log('Body Simulacros:', textSim.substring(0, 300));

  } catch (err) {
    console.error('Error testing endpoints:', err.message);
  }
}

testBackendEndpoints();
