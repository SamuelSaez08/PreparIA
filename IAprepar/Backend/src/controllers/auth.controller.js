'use strict';

const { validationResult } = require('express-validator');
const authService = require('../services/auth.service');
const { ok, created, fail } = require('../utils/response');

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return fail(res, errors.array()[0].msg, 400, errors.array());
    }
    const result = await authService.register(req.body);
    return created(res, 'Cuenta creada exitosamente.', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return fail(res, errors.array()[0].msg, 400, errors.array());
    }
    const { email, password } = req.body;
    const result = await authService.login({
      email, password,
      ip: req.ip,
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

module.exports = { register, login, logout };
