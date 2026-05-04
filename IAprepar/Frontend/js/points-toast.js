/* ============================================================
   PreparIA — points-toast.js
   Notificaciones emergentes de puntos / racha tras finalizar simulacro
   ============================================================ */

'use strict';

/**
 * Muestra una o varias notificaciones apiladas (top-right).
 *
 * @param {{
 *   points_earned : number,
 *   new_streak    : number,
 *   streak_bonus  : boolean,
 *   streak_broke  : boolean,
 *   perfect_bonus : boolean,
 *   shield_used   : boolean,
 * }} data — objeto `gamificacion` devuelto por POST /intentos/:id/finalizar
 */
function showPointsToast(data) {
  if (!data) return;

  const toasts = _buildToasts(data);
  toasts.forEach((t, i) => _mount(t, i * 120));
}

// ── Build toast descriptors ──────────────────────────────────
function _buildToasts(data) {
  const list = [];

  // Main points toast (always shown)
  if (data.points_earned != null) {
    list.push({
      type    : 'points',
      icon    : '⭐',
      title   : `+${data.points_earned} puntos`,
      subtitle: data.points_earned === 1 ? 'Punto obtenido' : 'Puntos obtenidos',
      shake   : false,
    });
  }

  // Streak broke
  if (data.streak_broke) {
    list.push({
      type    : 'streak-broke',
      icon    : '💔',
      title   : 'Racha perdida',
      subtitle: data.shield_used ? '¡Tu escudo te salvó!' : 'Fallaste un día. ¡Vuelve mañana!',
      shake   : true,
    });
  } else if (data.new_streak > 0) {
    // Active streak
    const isMilestone = data.new_streak % 7 === 0;
    list.push({
      type    : 'streak',
      icon    : isMilestone ? '🎉' : '🔥',
      title   : `Racha: ${data.new_streak} días`,
      subtitle: isMilestone
        ? `¡${data.new_streak} días seguidos! ¡Increíble!`
        : `¡Sigue así!`,
      shake   : false,
    });
  }

  // Streak bonus
  if (data.streak_bonus) {
    list.push({
      type    : 'bonus',
      icon    : '🎯',
      title   : '+20 pts bonus de racha',
      subtitle: '¡Múltiplo de 7 días seguidos!',
      shake   : false,
    });
  }

  // Perfect score
  if (data.perfect_bonus) {
    list.push({
      type    : 'perfect',
      icon    : '🏆',
      title   : '+15 pts por puntaje perfecto',
      subtitle: '¡100 de 100! Extraordinario.',
      shake   : false,
    });
  }

  return list;
}

// ── Mount a single toast ─────────────────────────────────────
function _mount(toast, delay) {
  const container = _getContainer();
  const el        = document.createElement('div');

  el.className = `points-toast toast-${toast.type}${toast.shake ? ' toast-shake' : ''}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = `
    <div class="toast-icon">${toast.icon}</div>
    <div class="toast-body">
      <div class="toast-title">${toast.title}</div>
      <div class="toast-subtitle">${toast.subtitle}</div>
    </div>
    <button class="toast-close" aria-label="Cerrar">×</button>
    <div class="toast-timer"></div>
  `;

  // Auto dismiss (4 s)
  const DURATION = 4000;
  let   dismissTimer;

  const dismiss = () => {
    el.classList.add('toast-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    clearTimeout(dismissTimer);
  };

  el.querySelector('.toast-close').addEventListener('click', dismiss);

  setTimeout(() => {
    container.appendChild(el);
    // Force reflow so the slide-in animation triggers
    void el.offsetWidth;
    el.classList.add('toast-visible');

    // Start dismiss timer after visible
    dismissTimer = setTimeout(dismiss, DURATION);
  }, delay);
}

// ── Container singleton ──────────────────────────────────────
function _getContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id        = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}
