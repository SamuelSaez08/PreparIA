/* ============================================================
   PreparIA — ranking.js  (rediseño clay v2)

   Cambios respecto a la versión anterior:
   · Arranca en "Esta semana": es la tabla donde todos compiten en
     igualdad, porque los puntos se reinician cada lunes.
   · La tarjeta de la derecha dice cuántos puntos faltan para subir
     un puesto, en vez de repetir cifras que ya están en otra parte.
   · Los nombres se escapan antes de pintarlos. Antes iban directo al
     HTML: un nombre de usuario con etiquetas se habría ejecutado en
     la pantalla de todos los que abrieran el ranking.
   ============================================================ */

'use strict';

const RankingPage = (() => {

  let currentPeriod   = 'weekly';
  let currentUser     = null;
  let leaderboardData = [];
  let totalEntries    = 0;
  let currentOffset   = 0;
  let _isLoadingMore  = false;
  let _pollTimer      = null;
  let _lastRefresh    = null;
  const PAGE_SIZE     = 50;
  const POLL_INTERVAL = 60_000;

  const NOTAS = {
    weekly:   'Los puntos de la semana se reinician cada lunes. Todos arrancan de cero.',
    monthly:  'Los puntos del mes se reinician el día 1.',
    all_time: 'Todos los puntos desde que te uniste a PreparIA.',
  };
  const ETIQUETA_PUNTOS = { weekly: 'Puntos esta semana', monthly: 'Puntos este mes', all_time: 'Puntos totales' };
  const MEDALLA = { 1: '#FFD93D', 2: '#C9CCD6', 3: '#E0A370' };
  const ALTURA  = { 1: 150, 2: 112, 3: 86 };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => Utils.sanitizeHTML(s ?? '');
  const miId = () => (currentUser ? (currentUser.id_usuario || currentUser.id) : null);

  function init() {
    if (typeof Auth !== 'undefined') Auth.requireAuth();
    currentUser = Session.getUser();
    Utils.renderUserInNav();
    $('logout-btn')?.addEventListener('click', () => Auth.logout());

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
    });
    marcarPestana();

    fetchLeaderboard(currentPeriod);
    if (currentUser) fetchUserStats(miId());

    _startPolling();
    document.addEventListener('visibilitychange', _onVisibilityChange);
    window.addEventListener('beforeunload', _stopPolling);
  }

  function marcarPestana() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      const on = btn.dataset.period === currentPeriod;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    const nota = $('rank-nota');
    if (nota) nota.textContent = NOTAS[currentPeriod];
    const lbl = $('rs-points-lbl');
    if (lbl) lbl.textContent = ETIQUETA_PUNTOS[currentPeriod];
  }

  function switchPeriod(period) {
    if (period === currentPeriod) return;
    currentPeriod = period;
    marcarPestana();
    fetchLeaderboard(period);
  }

  async function fetchLeaderboard(period) {
    showPodiumSkeleton();
    showTableSkeleton();
    $('lb-error').style.display = 'none';
    $('lb-empty').style.display = 'none';
    leaderboardData = []; currentOffset = 0; totalEntries = 0;

    try {
      const res  = await RankingAPI.getRanking(period, PAGE_SIZE, 0);
      const data = res.datos || {};
      totalEntries    = data.total_entries || 0;
      currentOffset   = PAGE_SIZE;
      leaderboardData = data.ranking || [];
      pintarMiPosicion(data.posicion_usuario);

      if (!leaderboardData.length) {
        clearPodium();
        $('lb-table-container').innerHTML = '';
        $('lb-table-container').hidden = true;
        $('lb-empty').style.display = 'flex';
        return;
      }
      $('lb-table-container').hidden = false;
      renderPodium(leaderboardData.slice(0, 3));
      renderTable(leaderboardData.slice(3));
      _lastRefresh = new Date();
      _updateRefreshLabel();
    } catch (_) {
      clearPodium();
      $('lb-table-container').innerHTML = '';
      $('lb-table-container').hidden = true;
      $('lb-error').style.display = 'flex';
    }
  }

  /* ── Tarjeta "Tu posición" ─────────────────────────────── */
  function pintarMiPosicion(p) {
    const pos = p && p.rank_position;
    $('rank-badge').textContent = pos ? `#${pos}` : '—';
    $('rank-total').textContent = p && p.total_users_ranked ? `de ${p.total_users_ranked} estudiantes` : 'aún sin posición';
    $('rs-points').textContent = p ? formatPoints(p.points || 0) : '—';

    const gap = $('rank-gap');
    if (!gap) return;
    if (!pos) {
      gap.hidden = false;
      $('rank-gap-txt').innerHTML = 'Haz un simulacro para entrar a la tabla de este periodo.';
      return;
    }
    if (pos === 1) {
      gap.hidden = false;
      $('rank-gap-txt').innerHTML = '<strong>Vas primero.</strong> Sigue practicando para mantener el puesto.';
      return;
    }
    const arriba = leaderboardData[pos - 2];
    if (!arriba) { gap.hidden = true; return; }
    const falta = Math.max(1, periodPoints(arriba) - (p.points || 0) + 1);
    gap.hidden = false;
    $('rank-gap-txt').innerHTML = `Te faltan <strong>${formatPoints(falta)} ${falta === 1 ? 'punto' : 'puntos'}</strong> para subir al #${pos - 1}.`;
  }

  async function loadMore() {
    if (_isLoadingMore || currentOffset >= totalEntries) return;
    _isLoadingMore = true;
    const btn = $('lb-load-more');
    if (btn) { btn.disabled = true; btn.textContent = 'Cargando…'; }
    try {
      const res  = await RankingAPI.getRanking(currentPeriod, PAGE_SIZE, currentOffset);
      const data = res.datos || {};
      const nuevas = data.ranking || [];
      const inicio = leaderboardData.length + 1;
      currentOffset += nuevas.length;
      totalEntries   = data.total_entries || totalEntries;
      leaderboardData = [...leaderboardData, ...nuevas];
      $('lb-rows')?.insertAdjacentHTML('beforeend', _buildRows(nuevas, inicio));
      _updateLoadMoreBtn();
    } catch (_) {
      UI.showToast('No se pudieron cargar más posiciones. Intenta de nuevo.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Cargar más'; }
    } finally {
      _isLoadingMore = false;
    }
  }

  function reload() { fetchLeaderboard(currentPeriod); }

  function _startPolling() { _stopPolling(); _pollTimer = setInterval(_silentRefresh, POLL_INTERVAL); }
  function _stopPolling() { if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; } }
  function _onVisibilityChange() { if (document.hidden) _stopPolling(); else { _silentRefresh(); _startPolling(); } }

  async function _silentRefresh() {
    try {
      const res  = await RankingAPI.getRanking(currentPeriod, PAGE_SIZE, 0);
      const data = res.datos || {};
      totalEntries = data.total_entries || 0;
      currentOffset = PAGE_SIZE;
      leaderboardData = data.ranking || [];
      pintarMiPosicion(data.posicion_usuario);
      if (leaderboardData.length) {
        renderPodium(leaderboardData.slice(0, 3));
        renderTable(leaderboardData.slice(3));
      }
      _lastRefresh = new Date();
      _updateRefreshLabel();
    } catch (_) { /* silencioso */ }
  }

  function _updateRefreshLabel() {
    const el = $('lb-refresh-label');
    if (!el || !_lastRefresh) return;
    const segs = Math.round((Date.now() - _lastRefresh) / 1000);
    el.textContent = segs < 5 ? 'Actualizado ahora' : segs < 60 ? `Actualizado hace ${segs} s` : `Actualizado hace ${Math.round(segs / 60)} min`;
  }

  function _updateLoadMoreBtn() {
    const btn = $('lb-load-more');
    if (!btn) return;
    btn.hidden = currentOffset >= totalEntries;
    btn.disabled = false;
    btn.textContent = 'Cargar más';
  }

  async function fetchUserStats(userId) {
    if (!userId) return;
    try {
      const res   = await RankingAPI.getUserStats(userId);
      const stats = (res.datos || {}).stats || {};
      const racha = stats.current_streak || 0;
      $('rs-streak').textContent = `${racha} ${racha === 1 ? 'día' : 'días'}`;
    } catch (_) { /* la tarjeta queda con guion */ }
  }

  /* ── Podio ─────────────────────────────────────────────── */
  function renderPodium(top3) {
    const orden = [top3[1], top3[0], top3[2]];
    const pos   = [2, 1, 3];
    $('podium-container').innerHTML = orden.map((e, i) => {
      if (!e) return '';
      const p = pos[i];
      const yo = miId() && e.user_id === miId();
      return `
        <div class="podium2-slot p${p}${yo ? ' is-me' : ''}" style="--medal:${MEDALLA[p]};--h:${ALTURA[p]}px">
          <span class="podium2-av" aria-hidden="true">${esc((e.nombre || '?')[0].toUpperCase())}</span>
          <span class="stack" style="align-items:center;gap:2px;max-width:100%">
            <span class="podium2-name">${esc(e.nombre || 'Estudiante')}${yo ? ' · Tú' : ''}</span>
            <span class="podium2-pts">${formatPoints(periodPoints(e))} pts</span>
          </span>
          <div class="podium2-block"><span class="podium2-medal" aria-label="Puesto ${p}">${p}</span></div>
        </div>`;
    }).join('');
  }

  function clearPodium() { $('podium-container').innerHTML = ''; }

  /* ── Tabla (puesto 4 en adelante) ──────────────────────── */
  function renderTable(entradas) {
    const cont = $('lb-table-container');
    if (!entradas.length) {
      cont.innerHTML = `<div class="empty" style="padding:18px">Solo hay ${leaderboardData.length} ${leaderboardData.length === 1 ? 'estudiante' : 'estudiantes'} en este periodo.</div>`;
      return;
    }
    cont.innerHTML = `
      <div id="lb-rows" class="stack gap-4">${_buildRows(entradas, 4)}</div>
      <button id="lb-load-more" type="button" class="btn btn-secondary btn-sm" style="align-self:center;margin:10px 0 4px" onclick="RankingPage.loadMore()" ${currentOffset >= totalEntries ? 'hidden' : ''}>Cargar más</button>`;
  }

  function _buildRows(entradas, desde) {
    return entradas.map((e, i) => {
      const yo = miId() && e.user_id === miId();
      const racha = e.current_streak ?? e.streak ?? 0;
      return `
        <div class="lb2-row${yo ? ' is-me' : ''}" data-rank="${desde + i}">
          <span class="lb2-pos">${desde + i}</span>
          <span class="lb2-av" aria-hidden="true">${esc((e.nombre || '?')[0].toUpperCase())}</span>
          <span class="lb2-name"><span>${esc(e.nombre || 'Estudiante')}</span>${yo ? '<span class="you">TÚ</span>' : ''}</span>
          <span class="lb2-streak" title="Racha">${Icon.svg('flame', 16)}<span>${racha > 0 ? racha : '—'}</span></span>
          <span class="lb2-pts">${formatPoints(periodPoints(e))}</span>
        </div>`;
    }).join('');
  }

  function showPodiumSkeleton() {
    $('podium-container').innerHTML = [2, 1, 3].map((p) => `
      <div class="podium2-slot p${p}" style="--medal:#23234A;--h:${ALTURA[p]}px" aria-hidden="true">
        <span class="podium2-av skel" style="border:none"></span>
        <span class="skel" style="width:90px;height:14px"></span>
        <div class="podium2-block" style="animation:none"></div>
      </div>`).join('');
  }

  function showTableSkeleton() {
    const c = $('lb-table-container');
    c.hidden = false;
    c.innerHTML = Array.from({ length: 5 }, () => '<div class="skel" style="height:60px;border-radius:16px"></div>').join('');
  }

  function periodPoints(e) {
    if (currentPeriod === 'weekly')  return e.weekly_points  ?? e.points ?? 0;
    if (currentPeriod === 'monthly') return e.monthly_points ?? e.points ?? 0;
    return e.points ?? 0;
  }

  function formatPoints(n) { return Number(n || 0).toLocaleString('es-CO'); }

  return { init, reload, loadMore, switchPeriod, fetchUserStats, _updateRefreshLabel };
})();

document.addEventListener('DOMContentLoaded', RankingPage.init);
