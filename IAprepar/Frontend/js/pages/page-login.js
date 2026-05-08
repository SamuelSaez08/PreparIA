'use strict';

const PageLogin = {
  init() {
    UI.initPasswordToggles();
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      Validate.clearAll(['email', 'password']);

      let ok = true;
      if (!Validate.email(email))         { Validate.showError('email',    'Ingresa un correo válido.'); ok = false; }
      if (!Validate.minLen(password, 6))  { Validate.showError('password', 'Mínimo 6 caracteres.');     ok = false; }
      if (!ok) return;

      const btn = form.querySelector('[type=submit]');
      const originalText = btn.textContent;
      btn.textContent = 'Ingresando…';
      btn.disabled = true;

      try {
        await AuthAPI.login(email, password);
        UI.showToast('¡Bienvenido de vuelta!');
        setTimeout(() => Utils.navigate('dashboard.html'), 800);
      } catch (err) {
        const msg = err.mensaje || 'Error al iniciar sesión.';
        if (err.networkError) {
          UI.showToast('Sin conexión. Verifica tu internet.', 'error');
        } else {
          UI.showToast(msg, 'error');
          if (msg.toLowerCase().includes('correo') || msg.toLowerCase().includes('email') || msg.toLowerCase().includes('usuario')) {
            Validate.showError('email', msg);
          } else if (msg.toLowerCase().includes('contraseña') || msg.toLowerCase().includes('password')) {
            Validate.showError('password', msg);
          } else {
            Validate.showError('email', msg);
          }
        }
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }
};
