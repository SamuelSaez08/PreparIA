'use strict';

/* ============================================================
   PreparIA — shell.js
   Navegación compartida del rediseño clay (v2).

   Antes cada página copiaba su propia barra superior, barra lateral
   y barra móvil, y se desincronizaban: el acceso al panel de
   administración solo existía en el inicio. Ahora las tres piezas
   salen de aquí.

   Se carga después de ui.js y ANTES del script de la página, así
   que #logout-btn, [data-user-name] y [data-admin-only] ya existen
   cuando la página llama a Utils.renderUserInNav().

   También expone Icon(nombre): íconos de trazo que heredan el color
   del texto. En el HTML basta con <i data-icon="home"></i>.
   ============================================================ */

const Icon = (() => {
  const P = {
    home:   '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    map:    '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
    clip:   '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4"/>',
    chart:  '<path d="M3 21h18"/><path d="M6 17v-5"/><path d="M11 17V6"/><path d="M16 17v-8"/><path d="M21 17v-3"/>',
    trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a3 3 0 0 0 3 4"/><path d="M17 6h3a3 3 0 0 1-3 4"/>',
    flame:  '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="m10 16-4-4 4-4"/><path d="M6 12h10"/>',
    chev:   '<path d="m9 6 6 6-6 6"/>',
    arrow:  '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    back:   '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
    clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check:  '<path d="m5 12.5 4.5 4.5L19 7"/>',
    play:   '<path d="M8 5.5v13l10.5-6.5z"/>',
    list:   '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4.5 6h.01"/><path d="M4.5 12h.01"/><path d="M4.5 18h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    spark:  '<path d="M12 3l2.1 6.4L20.5 12l-6.4 2.1L12 20.5l-2.1-6.4L3.5 12l6.4-2.6z"/>',
    x:      '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    lock:   '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    book:   '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    tree:   '<path d="M12 21v-6"/><path d="M6 15h12"/><path d="M6 15V9"/><path d="M18 15V9"/><circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V15"/>',
    info:   '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    up:     '<path d="m6 15 6-6 6 6"/>',
    tools:  '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus:   '<path d="M12 5v14"/><path d="M5 12h14"/>',
    refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    users:  '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>',
    eye:    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    route:  '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>',
    msg:    '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    trash:  '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  };

  const svg = (name, size = 20, stroke = 2) => P[name]
    ? `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name]}</svg>`
    : '';

  /** Sustituye cada <i data-icon="…"> por su SVG. */
  const hydrate = (root = document) => {
    root.querySelectorAll('i[data-icon]').forEach((el) => {
      const size = parseInt(el.dataset.size || '20', 10);
      const stroke = parseFloat(el.dataset.stroke || '2');
      el.outerHTML = svg(el.dataset.icon, size, stroke);
    });
  };

  return { svg, hydrate };
})();

const Shell = (() => {
  const LINKS = [
    { grupo: null,          href: 'dashboard.html',         icon: 'home',   label: 'Inicio',            corto: 'Inicio' },
    { grupo: 'Estudiar',    href: 'ciencias-sociales.html', icon: 'map',    label: 'Ciencias Sociales', corto: 'Temas' },
    { grupo: 'Estudiar',    href: 'simulacros.html',        icon: 'clip',   label: 'Simulacros',        corto: 'Simulacro' },
    { grupo: 'Tu progreso', href: 'estadisticas.html',      icon: 'chart',  label: 'Estadísticas',      corto: 'Progreso' },
    { grupo: 'Tu progreso', href: 'ranking.html',           icon: 'trophy', label: 'Ranking',           corto: 'Ranking' },
  ];

  const actual = () => {
    const p = window.location.pathname.split('/').pop() || 'dashboard.html';
    return p.endsWith('.html') ? p : p + '.html';
  };

  /* nodo.html es parte de Ciencias Sociales: se marca esa sección. */
  const seccion = () => (actual() === 'nodo.html' ? 'ciencias-sociales.html' : actual());

  const usuario = () => {
    try { return (typeof Session !== 'undefined' && Session.getUser()) || null; } catch { return null; }
  };

  const racha = () => {
    try { return (typeof Streak !== 'undefined' && Streak.get().count) || 0; } catch { return 0; }
  };

  const textoRacha = (n) => (n === 1 ? '1 día de racha' : `${n} días de racha`);
  const pistaRacha = (n) => (n > 0 ? 'Practica hoy para no perderla' : 'Haz un simulacro para empezarla');

  const navItem = (l, activo) => `
    <a href="${l.href}" class="nav-item${activo ? ' is-active' : ''}" data-nav="${l.href}"${activo ? ' aria-current="page"' : ''}>
      ${Icon.svg(l.icon)}<span>${l.label}</span>
    </a>`;

  const lateral = () => {
    const cur = seccion();
    const u = usuario();
    const nombre = u ? [u.nombre, u.apellido].filter(Boolean).join(' ') || u.correo || u.email : 'Estudiante';
    const inicial = (nombre || 'E').trim()[0].toUpperCase();
    const rol = u && u.rol === 'admin' ? 'Administrador' : 'Estudiante';
    const n = racha();

    const grupos = [];
    LINKS.forEach((l) => {
      let g = grupos.find((x) => x.nombre === l.grupo);
      if (!g) { g = { nombre: l.grupo, items: [] }; grupos.push(g); }
      g.items.push(l);
    });

    return `
<nav class="side" aria-label="Navegación principal">
  <a href="dashboard.html" class="side-logo" aria-label="PreparIA, ir al inicio">
    <span class="side-logo-mark">${Icon.svg('spark', 20, 2.2)}</span>
    <span class="side-logo-text">Prepar<span>IA</span></span>
  </a>
  ${grupos.map((g) => `
  <div class="side-group">
    ${g.nombre ? `<span class="side-label">${g.nombre}</span>` : ''}
    ${g.items.map((l) => navItem(l, l.href === cur)).join('')}
  </div>`).join('')}
  <div class="side-group" data-admin-only hidden>
    <span class="side-label">Gestión</span>
    ${navItem({ href: 'admin.html', icon: 'tools', label: 'Administración' }, cur === 'admin.html')}
  </div>
  <div class="side-spacer"></div>
  <div class="side-streak" data-shell-streak>
    <span class="side-streak-ico">${Icon.svg('flame', 22)}</span>
    <span class="side-streak-txt">
      <strong data-shell-streak-n>${textoRacha(n)}</strong>
      <small data-shell-streak-hint>${pistaRacha(n)}</small>
    </span>
  </div>
  <div class="side-user">
    <span class="avatar">${inicial}</span>
    <span class="side-user-txt">
      <strong data-user-name>${Utils.sanitizeHTML(u ? u.nombre || nombre : 'Estudiante')}</strong>
      <small>${rol}</small>
    </span>
    <button type="button" id="logout-btn" class="btn btn-text btn-icon-only" aria-label="Cerrar sesión" title="Cerrar sesión">${Icon.svg('logout')}</button>
  </div>
</nav>`;
  };

  const superiorMovil = () => {
    const u = usuario();
    const inicial = ((u && (u.nombre || u.correo || u.email)) || 'E').trim()[0].toUpperCase();
    return `
<header class="topbar-m">
  <a href="dashboard.html" class="side-logo-text">Prepar<span>IA</span></a>
  <div class="topbar-m-right">
    <span class="streak-chip" data-shell-streak-chip>${Icon.svg('flame', 16)}<span>${racha()}</span></span>
    <button type="button" class="avatar avatar-btn" aria-label="Tu cuenta" aria-haspopup="menu" aria-expanded="false" data-cuenta>${inicial}</button>
    <div class="m-menu" role="menu" hidden data-cuenta-menu>
      <button type="button" role="menuitem" class="m-menu-item" data-logout>${Icon.svg('logout', 18)}<span>Cerrar sesión</span></button>
    </div>
  </div>
</header>`;
  };

  const pestanas = () => {
    const cur = seccion();
    return `
<nav class="tabbar" aria-label="Navegación principal">
  ${LINKS.map((l) => `
  <a href="${l.href}" class="tab${l.href === cur ? ' is-active' : ''}"${l.href === cur ? ' aria-current="page"' : ''}>
    <span class="tab-pill">${Icon.svg(l.icon, 22)}</span><span>${l.corto}</span>
  </a>`).join('')}
</nav>`;
  };

  /** Actualiza la racha en la barra lateral cuando la página la obtiene del servidor. */
  const setRacha = (n) => {
    const v = Number(n) || 0;
    document.querySelectorAll('[data-shell-streak-n]').forEach((el) => { el.textContent = textoRacha(v); });
    document.querySelectorAll('[data-shell-streak-hint]').forEach((el) => { el.textContent = pistaRacha(v); });
    document.querySelectorAll('[data-shell-streak-chip] span').forEach((el) => { el.textContent = v; });
  };

  const montar = () => {
    if (!document.body.classList.contains('v2')) return;
    // Páginas públicas (landing, acceso, 404): mismo sistema visual, sin navegación de la app.
    if (document.body.hasAttribute('data-sin-nav')) { Icon.hydrate(); return; }
    document.body.insertAdjacentHTML('afterbegin', lateral() + superiorMovil());
    document.body.insertAdjacentHTML('beforeend', pestanas());
    document.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', () => {
      if (typeof Auth !== 'undefined') Auth.logout();
    }));

    // Menú de cuenta en móvil: el cierre de sesión no queda a un toque accidental.
    const btn = document.querySelector('[data-cuenta]');
    const menu = document.querySelector('[data-cuenta-menu]');
    if (btn && menu) {
      const cerrar = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        btn.setAttribute('aria-expanded', String(!menu.hidden));
      });
      document.addEventListener('click', (e) => { if (!menu.contains(e.target)) cerrar(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
    }
    Icon.hydrate();
    if (typeof Utils !== 'undefined') Utils.renderUserInNav();

    // Inicio y Estadísticas ya piden el progreso; el resto de páginas
    // lo consulta aquí para que la racha de la barra no quede desactualizada.
    if (!document.body.hasAttribute('data-racha-propia') && typeof ProgresoAPI !== 'undefined'
        && typeof Session !== 'undefined' && Session.isLoggedIn()) {
      ProgresoAPI.getProgreso()
        .then((res) => {
          const d = (res && res.datos) || {};
          if (typeof Streak !== 'undefined') Streak.updateFromBackend(d);
          setRacha(d.racha_actual || 0);
        })
        .catch(() => { /* se queda con el último valor conocido */ });
    }
  };

  return { montar, setRacha };
})();

Shell.montar();
