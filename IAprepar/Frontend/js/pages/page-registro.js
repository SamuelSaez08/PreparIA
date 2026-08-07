'use strict';

const PageRegistro = {
  init() {
    UI.initPasswordToggles();
    const form = document.getElementById('registro-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = ['nombre', 'email', 'grado', 'password', 'confirm'];
      Validate.clearAll(fields);

      const v = {
        nombre:   document.getElementById('nombre').value,
        email:    document.getElementById('email').value,
        grado:    document.getElementById('grado').value,
        password: document.getElementById('password').value,
        confirm:  document.getElementById('confirm').value,
      };

      let ok = true;
      if (!Validate.minLen(v.nombre, 2))              { Validate.showError('nombre',   'Ingresa tu nombre completo.');       ok = false; }
      if (!Validate.email(v.email))                   { Validate.showError('email',    'Correo electrónico inválido.');       ok = false; }
      if (!Validate.noEmpty(v.grado))                 { Validate.showError('grado',    'Selecciona tu grado.');              ok = false; }
      if (!Validate.minLen(v.password, 8))            { Validate.showError('password', 'Mínimo 8 caracteres.');             ok = false; }
      if (!Validate.match(v.password, v.confirm))     { Validate.showError('confirm',  'Las contraseñas no coinciden.');     ok = false; }
      if (!ok) return;

      const btn = form.querySelector('[type=submit]');
      const originalText = btn.textContent;
      btn.textContent = 'Creando cuenta…';
      btn.disabled = true;

      try {
        const parts   = v.nombre.trim().split(/\s+/);
        const nombre  = parts[0];
        const apellido = parts.length > 1 ? parts.slice(1).join(' ') : '';

        await AuthAPI.register(nombre, apellido, v.email, v.password, v.grado);
        UI.showToast('¡Cuenta creada! Iniciando…');
        setTimeout(() => Utils.navigate('dashboard.html'), 900);
      } catch (err) {
        const msg = err.mensaje || 'Error al crear la cuenta.';
        if (err.networkError) {
          UI.showToast('Sin conexión. Verifica tu internet.', 'error');
        } else if (err.status === 409) {
          Validate.showError('email', 'Este correo ya está registrado.');
          UI.showToast('Este correo ya está registrado.', 'error');
        } else {
          UI.showToast(msg, 'error');
          Validate.showError('email', msg);
        }
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

    const pwdInput    = document.getElementById('password');
    const strengthBar = document.getElementById('pwd-strength');
    if (pwdInput && strengthBar) {
      pwdInput.addEventListener('input', () => {
        const v = pwdInput.value;
        let score = 0;
        if (v.length >= 6)          score++;
        if (v.length >= 10)         score++;
        if (/[A-Z]/.test(v))        score++;
        if (/[0-9]/.test(v))        score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        const pct   = (score / 5) * 100;
        const color = score <= 1 ? 'var(--coral)' : score <= 3 ? 'var(--amber)' : 'var(--acid)';
        strengthBar.style.width      = pct + '%';
        strengthBar.style.background = color;
      });
    }
  }
};
