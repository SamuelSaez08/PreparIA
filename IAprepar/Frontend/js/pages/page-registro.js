'use strict';

/**
 * RF-02 — Registro de estudiantes.
 * Captura nombre, correo, grado, institución educativa y datos de contacto
 * (ciudad y teléfono), tal como especifica el SRS.
 */
const PageRegistro = {
  init() {
    UI.initPasswordToggles();
    const form = document.getElementById('registro-form');
    if (!form) return;

    const CAMPOS = ['nombre', 'email', 'grado', 'institucion', 'ciudad', 'telefono', 'password', 'confirm'];

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      Validate.clearAll(CAMPOS);

      const v = {};
      CAMPOS.forEach((id) => {
        const el = document.getElementById(id);
        v[id] = el ? el.value.trim() : '';
      });

      let ok = true;
      if (!Validate.minLen(v.nombre, 2))            { Validate.showError('nombre',      'Ingresa tu nombre completo.');            ok = false; }
      if (!Validate.email(v.email))                 { Validate.showError('email',       'Correo electrónico inválido.');           ok = false; }
      if (!Validate.noEmpty(v.grado))               { Validate.showError('grado',       'Selecciona tu grado.');                   ok = false; }
      if (!Validate.minLen(v.institucion, 3))       { Validate.showError('institucion', 'Escribe el nombre de tu colegio o institución.'); ok = false; }
      if (!/^[0-9+\-\s()]{7,20}$/.test(v.telefono)) { Validate.showError('telefono',    'Teléfono inválido. Usa solo números, espacios, + y guiones.'); ok = false; }
      if (!Validate.minLen(v.password, 8))          { Validate.showError('password',    'Mínimo 8 caracteres.');                   ok = false; }
      if (!Validate.match(v.password, v.confirm))   { Validate.showError('confirm',     'Las contraseñas no coinciden.');          ok = false; }

      const terms = document.getElementById('terms');
      if (terms && !terms.checked) {
        UI.showToast('Debes aceptar los términos de uso para continuar.', 'error');
        ok = false;
      }

      if (!ok) return;

      const btn = form.querySelector('[type=submit]');
      const originalText = btn.textContent;
      btn.textContent = 'Creando cuenta…';
      btn.disabled = true;

      try {
        const partes   = v.nombre.split(/\s+/);
        const nombre   = partes[0];
        const apellido = partes.length > 1 ? partes.slice(1).join(' ') : '';

        await AuthAPI.register({
          nombre,
          apellido,
          email:       v.email,
          password:    v.password,
          grado:       v.grado,
          institucion: v.institucion,
          ciudad:      v.ciudad,
          telefono:    v.telefono,
        });

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
        }
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

    // Indicador visual de robustez de la contraseña.
    const pwdInput    = document.getElementById('password');
    const strengthBar = document.getElementById('pwd-strength');
    if (pwdInput && strengthBar) {
      pwdInput.addEventListener('input', () => {
        const valor = pwdInput.value;
        let score = 0;
        if (valor.length >= 8)          score++;
        if (valor.length >= 12)         score++;
        if (/[A-Z]/.test(valor))        score++;
        if (/[0-9]/.test(valor))        score++;
        if (/[^A-Za-z0-9]/.test(valor)) score++;
        const pct   = (score / 5) * 100;
        const color = score <= 1 ? 'var(--coral)' : score <= 3 ? 'var(--amber)' : 'var(--acid)';
        strengthBar.style.width      = pct + '%';
        strengthBar.style.background = color;
      });
    }
  }
};
