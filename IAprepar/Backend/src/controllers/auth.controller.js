'use strict';

const { validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const { ok, created, fail } = require('../utils/response');

const _validar = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    fail(res, errors.array()[0].msg, 400, errors.array());
    return false;
  }
  return true;
};

const register = async (req, res, next) => {
  try {
    if (!_validar(req, res)) return;

    const result = await authService.register({
      ...req.body,
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
    });
    return created(res, 'Cuenta creada exitosamente.', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    if (!_validar(req, res)) return;

    const { email, password } = req.body;
    const result = await authService.login({
      email, password,
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
    });
    return ok(res, 'Inicio de sesión exitoso.', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const result = await authService.logout(req.user.id_usuario);
    return ok(res, 'Sesión cerrada exitosamente.', result);
  } catch (err) {
    next(err);
  }
};

const cambiarPassword = async (req, res, next) => {
  try {
    if (!_validar(req, res)) return;

    const { password_actual, password_nueva } = req.body;
    const result = await authService.cambiarPassword(req.user.id_usuario, password_actual, password_nueva);
    return ok(res, 'Contraseña actualizada. Inicia sesión de nuevo.', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

module.exports = { register, login, logout, cambiarPassword };
