/* ============================================================
   PreparIA — streak-widget.js
   Mini calendario de 7 días + lógica de racha
   ============================================================ */

'use strict';

/**
 * Renders a 7-day streak mini-calendar inside `containerId`.
 *
 * @param {string} containerId - ID of the container element
 * @param {{ current_streak: number, activity_dates: string[] }} streakData
 *   activity_dates: array of ISO date strings (YYYY-MM-DD) for days the user was active
 */
function initStreakWidget(containerId, streakData) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { current_streak = 0, activity_dates = [] } = streakData || {};

  // Normalise activity_dates to a Set of 'YYYY-MM-DD' strings
  const activeDates = new Set(
    (activity_dates || []).map(d => {
      const date = new Date(d);
      return isNaN(date) ? null : _toYMD(date);
    }).filter(Boolean)
  );

  // Build 7-day window ending today
  const today = new Date();
  const days  = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }

  // ── Render ──────────────────────────────────────────────
  if (current_streak === 0 && activeDates.size === 0) {
    container.innerHTML = _renderMotivationalCTA();
    return;
  }

  const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const circles = days.map(d => {
    const ymd     = _toYMD(d);
    const isToday = ymd === _toYMD(today);
    const active  = activeDates.has(ymd);
    const label   = dayLabels[d.getDay()];

    let cls = 'streak-day';
    if (active)  cls += ' active done'; // 'done' keeps compat with styles.css dashboard
    if (isToday) cls += ' today';

    return `
      <div class="${cls}" title="${_formatDate(d)}">
        <div class="streak-day-circle">${active ? '✓' : label}</div>
        <div class="streak-day-label">${label}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="streak-calendar">${circles}</div>
    ${_renderStreakMessage(current_streak)}
  `;

  // 🎉 Confetti burst if streak is a multiple of 7
  if (current_streak > 0 && current_streak % 7 === 0) {
    _burstConfetti(containerId);
  }
}

// ── Private helpers ──────────────────────────────────────────

function _toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function _formatDate(date) {
  return date.toLocaleDateString('es-CO', { weekday: 'long', month: 'short', day: 'numeric' });
}

function _renderStreakMessage(streak) {
  if (streak === 0) return '';

  let msg = '';
  if (streak === 1)                           msg = '¡Buen comienzo! Vuelve mañana.';
  else if (streak < 7)                        msg = `¡${streak} días seguidos! Sigue así.`;
  else if (streak % 7 === 0)                  msg = `🎉 ¡${streak} días! Racha épica.`;
  else if (streak >= 30)                      msg = `🔥 ¡${streak} días! Eres imparable.`;
  else                                        msg = `🔥 ${streak} días en racha.`;

  return `<p class="streak-message">${msg}</p>`;
}

function _renderMotivationalCTA() {
  return `
    <div class="streak-zero-cta">
      <div class="streak-zero-emoji">🌱</div>
      <p class="streak-zero-text">Aún no tienes racha.<br>¡Completa un simulacro hoy para empezar!</p>
      <a href="simulacros.html" class="btn btn-outline btn-sm" style="margin-top:8px">Ir a simulacros</a>
    </div>
  `;
}

// CSS confetti burst — spawns small particles via DOM for milestone streaks
function _burstConfetti(nearId) {
  const refEl = document.getElementById(nearId) || document.body;
  const rect  = refEl.getBoundingClientRect();
  const ox     = rect.left + rect.width  / 2;
  const oy     = rect.top  + rect.height / 2;

  const colors = ['#BFFF00', '#FFD93D', '#FF6B6B', '#4ECDC4', '#C0C0C0', '#FFB347'];
  const count  = 40;

  // Use a dedicated confetti container if available, else body
  const stage = document.getElementById('confetti-container') || document.body;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';

    const angle  = Math.random() * 360;
    const dist   = 60 + Math.random() * 120;
    const dx     = Math.cos((angle * Math.PI) / 180) * dist;
    const dy     = Math.sin((angle * Math.PI) / 180) * dist - 60;
    const color  = colors[Math.floor(Math.random() * colors.length)];
    const size   = 6 + Math.floor(Math.random() * 6);
    const dur    = 700 + Math.random() * 500;
    const delay  = Math.random() * 150;

    piece.style.cssText = `
      position:fixed;
      left:${ox}px;
      top:${oy}px;
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      pointer-events:none;
      z-index:9999;
      animation: confetti-fall ${dur}ms ease-out ${delay}ms forwards;
      --dx:${dx}px;
      --dy:${dy}px;
    `;

    stage.appendChild(piece);
    setTimeout(() => piece.remove(), dur + delay + 50);
  }
}
