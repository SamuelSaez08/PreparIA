'use strict';

const router = require('express').Router();
const authCtrl = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { loginRules, registerRules } = require('../utils/validators');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');

router.post('/register', authLimiter, registerRules, authCtrl.register);
router.post('/login',    authLimiter, loginRules,    authCtrl.login);
router.post('/logout',   authenticate,               authCtrl.logout);

module.exports = router;
