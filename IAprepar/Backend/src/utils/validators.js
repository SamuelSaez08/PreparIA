'use strict';

const { body } = require('express-validator');

const loginRules = [
  body('email').isEmail().withMessage('Correo electrónico inválido.').trim().toLowerCase(),
  body('password').notEmpty().withMessage('La contraseña es requerida.'),
];

const registerRules = [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido.'),
  body('apellido').trim().optional(),
  body('email').isEmail().withMessage('Correo electrónico inválido.').trim().toLowerCase(),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener mínimo 8 caracteres.'),
];

const validateIniciarIntento = [
  body('id_simulacro').isInt({ min: 1 }).withMessage('id_simulacro debe ser un entero positivo'),
];

const validateResponder = [
  body('id_pregunta').isInt({ min: 1 }).withMessage('id_pregunta debe ser un entero positivo'),
  body('id_opcion').isInt({ min: 1 }).withMessage('id_opcion debe ser un entero positivo'),
];

const validateCrearNodo = [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio').trim().isLength({ max: 200 }).withMessage('El nombre no puede superar 200 caracteres'),
];

module.exports = { loginRules, registerRules, validateIniciarIntento, validateResponder, validateCrearNodo };
