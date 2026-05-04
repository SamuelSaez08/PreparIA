/* ============================================================
   PreparIA — ranking.js
   Lógica completa de la página de ranking global
   ============================================================ */

'use strict';

const RankingPage = (() => {

  // ── State ────────────────────────────────────────────────
  let currentPeriod   = 'all_time';
  let currentUser     = null;
  let leaderboardData = [];
  let _pollTimer      = null;
  let _lastRefresh    = null;
  const POLL_INTERVAL = 60_000; // 60 segundos

  // ── DOM refs ─────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  // ── Init ─────────────────────────────────────────────────
  function init() {
    if (typeof Auth !== 'undefined') Auth.requireAuth();
    currentUser = Session.getUser();

    // Tab listeners
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
    });

    // Hydrate username in navbar
    if (currentUser) {
      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = currentUser.nombre || currentUser.email;
      });
    }

    // Kick off both fetches in parallel
    fetchLeaderboard(currentPeriod);
    if (currentUser) fetchUserStats(currentUser.id_usuario || currentUser.id);

    // Auto-refresh: pausa cuando el tab está oculto, reanuda al volver
    _startPolling();
    document.addEventListener('visibilitychange', _onVisibilityChange);
  }

  // ── Period switch ─────────────────────────────────────────
  function switchPeriod(period) {
    if (period === currentPeriod) return;
    currentPeriod = period;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });

    fetchLeaderboard(period);
  }

  // ── Fetch leaderboard ─────────────────────────────────────
  async function fetchLeaderboard(period) {
    showPodiumSkeleton();
    showTableSkeleton();
    $('lb-error').style.display  = 'none';
    $('lb-empty').style.display  = 'none';

    try {
      const res = await RankingAPI.getRanking(period);
      leaderboardData = (res.datos && res.datos.ranking) ? res.datos.ranking : (res.datos || []);
      
      // Update my rank badge if user info is available
      if (res.datos && res.datos.posicion_usuario) {
        const rb = $('rank-badge');
        if (rb) rb.textContent = `#${res.datos.posicion_usuario.rank_position || '—'}`;
      }

      if (!leaderboardData.length) {
        clearPodium();
        $('lb-table-container').innerHTML = '';
        $('lb-empty').style.display = 'flex';
        return;
      }

      renderPodium(leaderboardData.slice(0, 3));
      renderTable(leaderboardData.slice(3), currentUser);

      const total = $('total-label');
      if (total) {
        total.textContent = `${leaderboardData.length} estudiantes`;
        total.style.display = '';
      }

      _lastRefresh = new Date();
      _updateRefreshLabel();

    } catch (err) {
      clearPodium();
      $('lb-table-container').innerHTML = '';
      $('lb-error').style.display = 'flex';
    }
  }

  // ── Reload (for error retry button) ──────────────────────
  function reload() {
    fetchLeaderboard(currentPeriod);
  }

  // ── Auto-polling ──────────────────────────────────────────
  function _startPolling() {
    _stopPolling();
    _pollTimer = setInterval(_silentRefresh, POLL_INTERVAL);
  }

  function _stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  function _onVisibilityChange() {
    if (document.hidden) {
      _stopPolling();
    } else {
      // Refrescar inmediatamente al volver al tab y reactivar polling
      _silentRefresh();
      _startPolling();
    }
  }

  async function _silentRefresh() {
    try {
      const res = await RankingAPI.getRanking(currentPeriod);
      leaderboardData = (res.datos && res.datos.ranking) ? res.datos.ranking : (res.datos || []);

      if (res.datos && res.datos.posicion_usuario) {
        const rb = $('rank-badge');
        if (rb) rb.textContent = `#${res.datos.posicion_usuario.rank_position || '—'}`;
      }

      if (leaderboardData.length) {
        renderPodium(leaderboardData.slice(0, 3));
        renderTable(leaderboardData.slice(3), currentUser);
        const total = $('total-label');
        if (total) total.textContent = `${leaderboardData.length} estudiantes`;
      }

      _lastRefresh = new Date();
      _updateRefreshLabel();
    } catch (_) {
      // Silencioso: no mostrar error en auto-refresh, esperar el siguiente tick
    }
  }

  function _updateRefreshLabel() {
    const el = $('lb-refresh-label');
    if (!el || !_lastRefresh) return;
    const segs = Math.round((Date.now() - _lastRefresh) / 1000);
    el.textContent = segs < 5 ? 'Actualizado ahora' : `Actualizado hace ${segs}s`;
  }

  // ── Fetch user stats (right panel) ───────────────────────
  async function fetchUserStats(userId) {
    if (!userId) return;

    try {
      const res  = await RankingAPI.getUserStats(userId);
      const data = res.datos || {};
      const stats = data.stats || {};

      // Populate right panel
      const initials = (currentUser.nombre || currentUser.email || '?')[0].toUpperCase();
      $('rank-avatar').textContent = initials;
      $('rank-name').textContent   = currentUser.nombre || currentUser.email;

      // Rank badge is updated from fetchLeaderboard instead, to ensure consistency

      // Animate counters
      animateCounter($('rs-points'), stats.total_points    || 0, 900);
      animateCounter($('rs-streak'), stats.current_streak  || 0, 700);
      animateCounter($('rs-sims'),   stats.total_simulations|| 0, 800);

      const avgEl = $('rs-avg');
      if (avgEl) {
        const avg = parseFloat(stats.avg_score) || 0;
        setTimeout(() => { avgEl.textContent = avg.toFixed(1); }, 300);
      }

      // Streak widget
      $('panel-streak-count').textContent = stats.current_streak || 0;
      initStreakWidget('streak-widget-container', {
        current_streak: stats.current_streak || 0,
        activity_dates: (data.historial_actividad_30d || []).map(d => d.activity_date),
      });

      // Shields panel
      const shields = Array.isArray(data.escudos) ? data.escudos : [];
      if (shields.length > 0) {
        $('shields-panel').style.display  = '';
        $('shields-count').textContent    = `${shields.length} escudo${shields.length !== 1 ? 's' : ''} disponible${shields.length !== 1 ? 's' : ''}`;
      }

    } catch (_) {
      // Stats panel stays with placeholder dashes
    }
  }

  // ── Render Podium ─────────────────────────────────────────
  function renderPodium(top3) {
    const positions = [2, 1, 3]; // visual order: silver · gold · bronze
    const medals    = ['🥈', '🥇', '🥉'];
    const labels    = ['silver', 'gold', 'bronze'];

    // Order: slot index 0 → position 2 (silver), 1 → position 1 (gold), 2 → position 3 (bronze)
    const orderMap = [1, 0, 2]; // visual column → top3 array index

    const container = $('podium-container');
    container.innerHTML = '';

    positions.forEach((pos, colIdx) => {
      const entry = top3[orderMap[colIdx]];
      if (!entry) return;

      const isMe = currentUser && (entry.user_id === (currentUser.id_usuario || currentUser.id));

      const slot = document.createElement('div');
      slot.className = `podium-slot position-${pos}${isMe ? ' is-me' : ''}`;

      const initials = (entry.nombre || '?')[0].toUpperCase();
      const pts      = periodPoints(entry);

      slot.innerHTML = `
        ${pos === 1 ? '<div class="podium-crown">👑</div>' : ''}
        <div class="podium-avatar" data-medal="${labels[colIdx]}">${initials}</div>
        <div class="podium-name">${entry.nombre || 'Estudiante'}</div>
        <div class="podium-points">${formatPoints(pts)} pts</div>
        <div class="podium-stand">${medals[colIdx]}</div>
      `;

      container.appendChild(slot);
    });
  }

  function clearPodium() {
    $('podium-container').innerHTML = '';
  }

  // ── Render Table ──────────────────────────────────────────
  function renderTable(entries, user) {
    const container = $('lb-table-container');

    if (!entries.length) {
      container.innerHTML = '';
      return;
    }

    const myId = user ? (user.id_usuario || user.id) : null;

    const rows = entries.map((entry, idx) => {
      const rank  = idx + 4;
      const isMe  = myId && entry.user_id === myId;
      const pts   = periodPoints(entry);
      const initials = (entry.nombre || '?')[0].toUpperCase();

      return `
        <div class="lb-row${isMe ? ' is-me' : ''}" style="animation-delay:${idx * 40}ms" data-rank="${rank}">
          <div class="lb-rank">${rank}</div>
          <div class="lb-user">
            <div class="lb-avatar">${initials}</div>
            <span class="lb-name">${entry.nombre || 'Estudiante'}${isMe ? ' <span class="you-badge">Tú</span>' : ''}</span>
          </div>
          <div class="lb-streak">
            ${entry.streak > 0 ? `<span class="streak-fire">${entry.streak}🔥</span>` : '<span class="muted">—</span>'}
          </div>
          <div class="lb-pts">${formatPoints(pts)}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="lb-table">
        <div class="lb-header">
          <span>#</span>
          <span>Estudiante</span>
          <span>Racha</span>
          <span>Puntos</span>
        </div>
        ${rows}
      </div>
    `;
  }

  // ── Counter animation ─────────────────────────────────────
  function animateCounter(el, target, duration) {
    if (!el) return;
    const start     = performance.now();
    const startVal  = 0;

    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = easeOutExpo(progress);
      el.textContent = Math.round(startVal + (target - startVal) * eased);
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  // ── Skeleton helpers ──────────────────────────────────────
  function showPodiumSkeleton() {
    const container = $('podium-container');
    container.innerHTML = `
      <div class="podium-slot position-2 skeleton-slot">
        <div class="podium-avatar skeleton"></div>
        <div class="skeleton" style="width:70px;height:13px;border-radius:4px;margin:6px auto 0"></div>
        <div class="podium-stand"></div>
      </div>
      <div class="podium-slot position-1 skeleton-slot">
        <div class="podium-crown" style="opacity:0.2">👑</div>
        <div class="podium-avatar skeleton"></div>
        <div class="skeleton" style="width:80px;height:13px;border-radius:4px;margin:6px auto 0"></div>
        <div class="podium-stand"></div>
      </div>
      <div class="podium-slot position-3 skeleton-slot">
        <div class="podium-avatar skeleton"></div>
        <div class="skeleton" style="width:65px;height:13px;border-radius:4px;margin:6px auto 0"></div>
        <div class="podium-stand"></div>
      </div>
    `;
  }

  function showTableSkeleton() {
    $('lb-table-container').innerHTML = `
      <div class="lb-table">
        <div class="lb-header"><span>#</span><span>Estudiante</span><span>Racha</span><span>Puntos</span></div>
        ${Array.from({ length: 6 }, (_, i) => `
          <div class="lb-row skeleton-row" style="animation-delay:${i * 60}ms">
            <div class="skeleton" style="height:44px;border-radius:var(--radius-md)"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Utils ─────────────────────────────────────────────────
  function periodPoints(entry) {
    if (currentPeriod === 'weekly')  return entry.weekly_points  ?? entry.points ?? 0;
    if (currentPeriod === 'monthly') return entry.monthly_points ?? entry.points ?? 0;
    return entry.points ?? 0;
  }

  function formatPoints(n) {
    return Number(n).toLocaleString('es-CO');
  }

  // ── Public API ────────────────────────────────────────────
  return { init, reload, switchPeriod, fetchUserStats, _updateRefreshLabel };

})();

// ── Bootstrap ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', RankingPage.init);
