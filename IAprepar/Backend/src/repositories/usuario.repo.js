'use strict';
const db = require('../config/db');

const findByEmail = (email) =>
  db.query('SELECT u.id, u.nombre, u.apellido, u.email, u.password_hash, u.activo, r.id AS id_rol, r.nombre AS rol FROM usuario u JOIN rol r ON r.id = u.id_rol WHERE u.email = $1', [email]);

const findById = (id) =>
  db.query('SELECT id, nombre, apellido, email, id_rol, activo FROM usuario WHERE id = $1', [id]);

const create = (client, { nombre, apellido, email, passwordHash, idRol }) =>
  client.query(
    'INSERT INTO usuario (nombre, apellido, email, password_hash, id_rol, activo, creado_en) VALUES ($1,$2,$3,$4,$5,true,NOW()) RETURNING id, nombre, apellido, email, id_rol, creado_en',
    [nombre, apellido, email, passwordHash, idRol]
  );

const createPerfil = (client, idUsuario, grado = null) =>
  client.query('INSERT INTO perfil_estudiante (id_usuario, grado, creado_en) VALUES ($1, $2, NOW())', [idUsuario, grado]);

const closeSessions = (idUsuario) =>
  db.query('UPDATE sesion_usuario SET activa = false, cerrada_en = NOW() WHERE id_usuario = $1 AND activa = true', [idUsuario]);

const createSession = ({ idUsuario, tokenHash, ip, userAgent, expiraEn }) =>
  db.query(
    'INSERT INTO sesion_usuario (id_usuario, token_hash, ip, user_agent, activa, iniciada_en, expira_en) VALUES ($1,$2,$3,$4,true,NOW(),$5)',
    [idUsuario, tokenHash, ip, userAgent, expiraEn]
  );

module.exports = { findByEmail, findById, create, createPerfil, closeSessions, createSession };
