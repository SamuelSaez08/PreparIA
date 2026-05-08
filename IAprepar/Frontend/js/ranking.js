/* ============================================================
   PreparIA — ranking.js
   Lógica completa de la página de ranking global
   ============================================================ */

'use strict';

const RankingPage = (() => {

  // ── State ────────────────────────────────────────────────
  let currentPeriod   = 'all_time';
  let currentUser     = null;
  let leaderboardData = [];   // filas cargadas hasta ahora (sin el top-3)
  let totalEntries    = 0;    // total de entradas en la vista (devuelto por el backend)
  let currentOffset   = 0;
  let _isLoadingMore  = false;
  let _pollTimer      = null;
  let _lastRefresh    = null;
  const PAGE_SIZE     = 50;
  const POLL_INTERVAL = 60_000;

  // ── DOM refs ─────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  // ── Init ─────────────────────────────────────────────────
  function init() {
    if (typeof Auth !== 'undefined') Auth.requireAuth();
    currentUser = Session.getUser();

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
    });

    if (currentUser) {
      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = currentUser.nombre || currentUser.email;
      });
    }

    fetchLeaderboard(currentPeriod);
    if (currentUser) fetchUserStats(currentUser.id_usuario || currentUser.id);

    _startPolling();
    document.addEventListener('visibilitychange', _onVisibilityChange);
    window.addEventListener('beforeunload', _stopPolling);
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

  // ── Fetch leaderboard (primera página) ───────────────────
  async function fetchLeaderboard(period) {
    showPodiumSkeleton();
    showTableSkeleton();
    $('lb-error').style.display = 'none';
    $('lb-empty').style.display = 'none';

    leaderboardData = [];
    currentOffset   = 0;
    totalEntries    = 0;

    try {
      const res  = await RankingAPI.getRanking(period, PAGE_SIZE, 0);
      const data = res.datos || {};

      totalEntries    = data.total_entries || 0;
      currentOffset   = PAGE_SIZE;
      leaderboardData = data.ranking || [];

      if (data.posicion_usuario) {
        const rb = $('rank-badge');
        if (rb) rb.textContent = `#${data.posicion_usuario.rank_position || '—'}`;
      }

      if (!leaderboardData.length) {
        clearPodium();
        $('lb-table-container').innerHTML = '';
        $('lb-empty').style.display = 'flex';
        return;
      }

      renderPodium(leaderboardData.slice(0, 3));
      renderTable(leaderboardData.slice(3), currentUser, false);
      _updateTotalLabel();

      _lastRefresh = new Date();
      _updateRefreshLabel();

    } catch (_) {
      clearPodium();
      $('lb-table-container').innerHTML = '';
      $('lb-error').style.display = 'flex';
    }
  }

  // ── Cargar más ────────────────────────────────────────────
  async function loadMore() {
    if (_isLoadingMore) return;
    if (currentOffset >= totalEntries) return;

    _isLoadingMore = true;
    const btn = $('lb-load-more');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Cargando…';
    }

    try {
      const res  = await RankingAPI.getRanking(currentPeriod, PAGE_SIZE, currentOffset);
      const data = res.datos || {};
      const newRows = data.ranking || [];

      currentOffset   += newRows.length;
      totalEntries     = data.total_entries || totalEntries;
      leaderboardData  = [...leaderboardData, ...newRows];

      appendRows(newRows, leaderboardData.length - newRows.length + 1);
      _updateLoadMoreBtn();
      _updateTotalLabel();
    } catch (_) {
      UI.showToast('Error al cargar más entradas. Intenta de nuevo.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Cargar más';
      }
    } finally {
      _isLoadingMore = false;
    }
  }

  // ── Reload ────────────────────────────────────────────────
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
      _silentRefresh();
      _startPolling();
    }
  }

  async function _silentRefresh() {
    try {
      // Refresco silencioso: sólo vuelve a pedir la primera página
      const res  = await RankingAPI.getRanking(currentPeriod, PAGE_SIZE, 0);
      const data = res.datos || {};

      totalEntries    = data.total_entries || 0;
      currentOffset   = PAGE_SIZE;
      leaderboardData = data.ranking || [];

      if (data.posicion_usuario) {
        const rb = $('rank-badge');
        if (rb) rb.textContent = `#${data.posicion_usuario.rank_position || '—'}`;
      }

      if (leaderboardData.length) {
        renderPodium(leaderboardData.slice(0, 3));
        renderTable(leaderboardData.slice(3), currentUser, false);
        _updateTotalLabel();
      }

      _lastRefresh = new Date();
      _updateRefreshLabel();
    } catch (_) { /* silencioso */ }
  }

  function _updateRefreshLabel() {
    const el = $('lb-refresh-label');
    if (!el || !_lastRefresh) return;
    const segs = Math.round((Date.now() - _lastRefresh) / 1000);
    el.textContent = segs < 5 ? 'Actualizado ahora' : `Actualizado hace ${segs}s`;
  }

  function _updateTotalLabel() {
    const total = $('total-label');
    if (total) {
      total.textContent  = `${totalEntries} estudiantes`;
      total.style.display = '';
    }
  }

  function _updateLoadMoreBtn() {
    const btn = $('lb-load-more');
    if (!btn) return;
    const hayMas = currentOffset < totalEntries;
    btn.style.display = hayMas ? '' : 'none';
    btn.disabled      = false;
    btn.textContent   = 'Cargar más';
  }

  // ── Fetch user stats ──────────────────────────────────────
  async function fetchUserStats(userId) {
    if (!userId) return;
    try {
      const res   = await RankingAPI.getUserStats(userId);
      const data  = res.datos || {};
      const stats = data.stats || {};

      const initials = (currentUser.nombre || currentUser.email || '?')[0].toUpperCase();
      $('rank-avatar').textContent = initials;
      $('rank-name').textContent   = currentUser.nombre || currentUser.email;

      animateCounter($('rs-points'), stats.total_points     || 0, 900);
      animateCounter($('rs-streak'), stats.current_streak   || 0, 700);
      animateCounter($('rs-sims'),   stats.total_simulations || 0, 800);

      const avgEl = $('rs-avg');
      if (avgEl) {
        const avg = parseFloat(stats.avg_score) || 0;
        setTimeout(() => { avgEl.textContent = avg.toFixed(1); }, 300);
      }

      $('panel-streak-count').textContent = stats.current_streak || 0;
      initStreakWidget('streak-widget-container', {
        current_streak:  stats.current_streak || 0,
        activity_dates:  (data.historial_actividad_30d || []).map(d => d.activity_date),
      });

      const shields = Array.isArray(data.escudos) ? data.escudos : [];
      if (shields.length > 0) {
        $('shields-panel').style.display = '';
        $('shields-count').textContent   =
          `${shields.length} escudo${shields.length !== 1 ? 's' : ''} disponible${shields.length !== 1 ? 's' : ''}`;
      }
    } catch (_) { /* stats panel queda con guiones */ }
  }

  // ── Render Podium ─────────────────────────────────────────
  function renderPodium(top3) {
    const positions = [2, 1, 3];
    const medals    = ['🥈', '🥇', '🥉'];
    const labels    = ['silver', 'gold', 'bronze'];
    const orderMap  = [1, 0, 2];

    const container = $('podium-container');
    container.innerHTML = '';

    positions.forEach((pos, colIdx) => {
      const entry = top3[orderMap[colIdx]];
      if (!entry) return;

      const isMe     = currentUser && (entry.user_id === (currentUser.id_usuario || currentUser.id));
      const slot     = document.createElement('div');
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

  // ── Render Table (reemplaza contenido completo) ───────────
  function renderTable(entries, user, append = false) {
    const container = $('lb-table-container');

    if (!entries.length && !append) {
      container.innerHTML = '';
      return;
    }

    const myId  = user ? (user.id_usuario || user.id) : null;
    const start = append ? leaderboardData.length - entries.length + 4 : 4;

    const rows = _buildRows(entries, myId, start);

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
      <div style="text-align:center;margin-top:20px">
        <button
          id="lb-load-more"
          class="btn btn-outline btn-sm"
          onclick="RankingPage.loadMore()"
          style="${currentOffset >= totalEntries ? 'display:none' : ''}"
        >Cargar más</button>
      </div>
    `;
  }

  // ── Append rows al final de la tabla existente ────────────
  function appendRows(newEntries, startRank) {
    const myId    = currentUser ? (currentUser.id_usuario || currentUser.id) : null;
    const table   = $('lb-table-container')?.querySelector('.lb-table');
    if (!table) return;

    const fragment = document.createDocumentFragment();
    const wrapper  = document.createElement('div');
    wrapper.innerHTML = _buildRows(newEntries, myId, startRank);
    while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);

    // Insertar antes del botón "Cargar más"
    const loadMoreWrap = $('lb-table-container')?.querySelector('div[style]');
    if (loadMoreWrap) {
      $('lb-table-container').insertBefore(fragment, loadMoreWrap);
    } else {
      table.appendChild(fragment);
    }
  }

  function _buildRows(entries, myId, startRank) {
    return entries.map((entry, idx) => {
      const rank     = startRank + idx;
      const isMe     = myId && entry.user_id === myId;
      const pts      = periodPoints(entry);
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
  }

  // ── Counter animation ─────────────────────────────────────
  function animateCounter(el, target, duration) {
    if (!el) return;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * easeOutExpo(progress));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  // ── Skeletons ─────────────────────────────────────────────
  function showPodiumSkeleton() {
    $('podium-container').innerHTML = `
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
  return { init, reload, loadMore, switchPeriod, fetchUserStats, _updateRefreshLabel };

})();

// ── Bootstrap ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', RankingPage.init);
