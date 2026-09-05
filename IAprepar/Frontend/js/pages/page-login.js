'use strict';

const PageLogin = {
  init() {
    UI.initPasswordToggles();

    // Si la sesión anterior se cerró sola (inactividad, cuenta desactivada,
    // token vencido), explicamos por qué en vez de dejar al usuario adivinando.
    try {
      const motivo = sessionStorage.getItem('preparia_motivo_salida');
      if (motivo) {
        sessionStorage.removeItem('preparia_motivo_salida');
        UI.showToast(motivo, 'error');
      }
    } catch { /* almacenamiento no disponible */ }

    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      Validate.clearAll(['email', 'password']);

      let ok = true;
      if (!Validate.email(email))        { Validate.showError('email',    'Ingresa un correo válido.'); ok = false; }
      if (!Validate.minLen(password, 8)) { Validate.showError('password', 'Mínimo 8 caracteres.');      ok = false; }
      if (!ok) return;

      const btn = form.querySelector('[type=submit]');
      const originalText = btn.textContent;
      btn.textContent = 'Ingresando…';
      btn.disabled = true;

      try {
        const res = await AuthAPI.login(email, password);
        UI.showToast('¡Bienvenido de vuelta!');

        // Los administradores entran directo a su panel (RF-03 / RF-04).
        const rol = res && res.datos && res.datos.usuario ? res.datos.usuario.rol : null;
        const destino = rol === 'admin' ? 'admin.html' : 'dashboard.html';
        setTimeout(() => Utils.navigate(destino), 800);
      } catch (err) {
        const msg = err.mensaje || 'Error al iniciar sesión.';
        if (err.networkError) {
          UI.showToast('Sin conexión. Verifica tu internet.', 'error');
        } else {
          UI.showToast(msg, 'error');
          if (msg.toLowerCase().includes('contraseña') || msg.toLowerCase().includes('password')) {
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
