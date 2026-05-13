'use strict';

const PageSimulacros = {
  state: {
    questions:     [],
    current:       0,
    answers:       {},
    failedAnswers: {},
    timer:         null,
    timeLeft:      0,
    finished:      false,
    startTime:     null,
    intentoId:     null,
    simulacroId:   null,
    simulacrosList: [],
  },

  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();
    UI.initModalCloseHandlers();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    const selectMateria = document.getElementById('ia-materia');
    if (selectMateria) {
      selectMateria.innerHTML = '<option value="1">Ciencias Sociales</option>';
    }

    await this.loadData();
  },

  async generateIAFast() {
    UI.openModal('ia-modal');
    document.getElementById('ia-form').classList.add('hidden');
    document.getElementById('ia-loading').classList.remove('hidden');

    try {
      const res = await IAAPI.generarSimulacro({
        id_materia: 1,
        id_nivel: 3,
        dificultad: 'mixta',
        mezclar_dificultad: true,
        cantidad: 10,
        titulo: `Simulacro con IA - ${new Date().toLocaleDateString()}`
      });

      UI.showToast(`✅ Simulacro generado con ${res.datos.total_preguntas} preguntas! Arrancando...`);
      UI.closeModal('ia-modal');
      this.state.simulacroId = res.datos.id_simulacro;
      await this.startSimulacro();
      this.loadData();
    } catch (err) {
      UI.showToast(err.mensaje || 'Error al generar simulacro', 'error');
      UI.closeModal('ia-modal');
    }
  },

  async generateIA() {
    const materiaId  = document.getElementById('ia-materia').value;
    const dificultad = document.getElementById('ia-dificultad').value;
    const cantidad   = document.getElementById('ia-cantidad').value;

    const form    = document.getElementById('ia-form');
    const loading = document.getElementById('ia-loading');

    if (!materiaId || !cantidad) {
      UI.showToast('Completa todos los campos obligatorios', 'error');
      return;
    }

    form.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
      const res = await IAAPI.generarSimulacro({
        id_materia:         parseInt(materiaId),
        id_nivel:           3,
        dificultad,
        mezclar_dificultad: dificultad === 'mixta',
        cantidad:           parseInt(cantidad),
        titulo: `Simulacro con IA - ${new Date().toLocaleDateString()}`
      });

      UI.showToast(`✅ Simulacro generado con ${res.datos.total_preguntas} preguntas!`);
      UI.closeModal('ia-modal');
      form.classList.remove('hidden');
      loading.classList.add('hidden');
      document.getElementById('ia-contexto').value = '';
      await this.loadData();
    } catch (err) {
      UI.showToast(err.mensaje || 'Error al generar simulacro', 'error');
      form.classList.remove('hidden');
      loading.classList.add('hidden');
    }
  },

  async loadData() {
    try {
      const historialRes = await SimulacrosAPI.getHistorial({ por_pagina: 5 });
      Simulacros.updateFromBackend(historialRes.datos || []);
    } catch (err) {
      console.warn('Could not load history:', err);
    }
    this.renderHistory();

    try {
      const simRes = await SimulacrosAPI.getSimulacros({ materia: 1 });
      const simulacros = simRes.datos || [];
      this.state.simulacrosList = simulacros;
      if (simulacros.length > 0) {
        this.state.simulacroId = simulacros[0].id || simulacros[0].id_simulacro;
      }
    } catch (err) {
      console.warn('Could not load simulacros:', err);
      if (err.networkError) UI.showToast('Sin conexión. Verifica tu internet.', 'error');
    }
  },

  async startSimulacro() {
    const btn = document.getElementById('start-btn');
    const s   = this.state;

    if (!s.simulacroId) {
      UI.showToast('No hay simulacros disponibles. Contacta al administrador.', 'error');
      return;
    }

    let originalText;
    if (btn) {
      originalText = btn.textContent;
      btn.textContent = 'Cargando simulacro…';
      btn.disabled = true;
    }

    try {
      const res   = await SimulacrosAPI.iniciarIntento(s.simulacroId);
      const datos = res.datos || res;

      s.intentoId     = datos.intento?.id || datos.intento?.id_intento || datos.id_intento || datos.id;
      s.questions     = (datos.preguntas || []).map(p => ({
        id:         p.id || p.id_pregunta,
        tema:       p.tema || p.categoria || 'General',
        texto_base: p.texto_base ?? p.contexto ?? '',
        text:       p.enunciado || p.texto || p.text,
        options:    (p.opciones || p.options || []).map(o => ({
          id:    o.id || o.id_opcion,
          text:  o.texto || o.text || o.contenido,
          letra: o.letra
        })),
        correct:     null,
        explanation: p.explicacion || '',
      }));
      s.current       = 0;
      s.answers       = {};
      s.failedAnswers = {};
      s.finished      = false;
      s.timeLeft      = (datos.simulacro?.duracion_minutos || 20) * 60;
      s.startTime     = Date.now();

      // Bug B fix: restore timer from sessionStorage if the page was reloaded mid-simulacro
      if (s.intentoId) {
        const saved = parseInt(sessionStorage.getItem(`preparia_timer_${s.intentoId}`), 10);
        if (Number.isFinite(saved) && saved > 0 && saved < s.timeLeft) {
          s.timeLeft = saved;
        }
      }

      document.getElementById('simulacro-start')?.classList.add('hidden');
      document.getElementById('simulacro-quiz')?.classList.remove('hidden');

      this.renderQuestion();
      this.startTimer();
    } catch (err) {
      console.error('Error starting simulacro:', err);
      if (err.networkError) {
        UI.showToast('Sin conexión. Verifica tu internet.', 'error');
      } else {
        UI.showToast(err.mensaje || 'Error al iniciar el simulacro.', 'error');
      }
      if (btn) { btn.textContent = originalText; btn.disabled = false; }
    }
  },

  renderQuestion() {
    const s   = this.state;
    const q   = s.questions[s.current];
    if (!q) return;

    const total = s.questions.length;
    document.getElementById('q-progress').textContent = `${s.current + 1} / ${total}`;
    const bar = document.getElementById('q-progress-bar');
    if (bar) bar.style.width = ((s.current + 1) / total * 100) + '%';

    document.getElementById('question-container').innerHTML = `
      <div class="question-card fade-in-up">
        <div class="question-number">Pregunta ${s.current + 1} · ${Utils.sanitizeHTML(q.tema)}</div>
        ${q.texto_base ? `<div class="question-context">${Utils.sanitizeHTML(q.texto_base)}</div>` : ''}
        <div class="question-text">${Utils.sanitizeHTML(q.text)}</div>
        <div class="options-list" id="options-list">
          ${q.options.map((opt, i) => `
            <div class="option-item ${s.answers[q.id] === i ? 'selected' : ''}"
                 data-index="${i}" onclick="PageSimulacros.selectAnswer(${i})">
              <div class="option-letter">${String.fromCharCode(65 + i)}</div>
              <div>${Utils.sanitizeHTML(typeof opt === 'string' ? opt : opt.text)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-prev').disabled = s.current === 0;
    document.getElementById('btn-next').textContent = s.current === total - 1 ? 'Finalizar 🏁' : 'Siguiente →';
  },

  selectAnswer(index) {
    const s = this.state;
    const q = s.questions[s.current];
    s.answers[q.id] = index;

    document.querySelectorAll('.option-item').forEach((el, i) => {
      el.classList.toggle('selected', i === index);
    });

    if (!s.intentoId) return;

    const opcion   = q.options[index];
    const idOpcion = typeof opcion === 'object' ? opcion.id : index;
    const btnNext  = document.getElementById('btn-next');

    if (btnNext) btnNext.disabled = true;
    delete s.failedAnswers[q.id];

    SimulacrosAPI.responderPregunta(s.intentoId, q.id, idOpcion)
      .then(() => { if (btnNext) btnNext.disabled = false; })
      .catch(err => {
        if (btnNext) btnNext.disabled = false;
        if (err.status === 410) {
          UI.showToast('⏰ Tiempo agotado. Finalizando simulacro…', 'warning');
          this.finishSimulacro();
          return;
        }
        s.failedAnswers[q.id] = { questionId: q.id, idOpcion };
        UI.showToast('No se pudo guardar la respuesta. Se reintentará al avanzar.', 'warning');
      });
  },

  async _retryAnswer(questionId) {
    const s      = this.state;
    const failed = s.failedAnswers[questionId];
    if (!failed) return;
    try {
      await SimulacrosAPI.responderPregunta(s.intentoId, failed.questionId, failed.idOpcion);
      delete s.failedAnswers[questionId];
    } catch { /* vuelve a intentar en finalizarIntento */ }
  },

  prevQuestion() {
    if (this.state.current > 0) {
      this.state.current--;
      this.renderQuestion();
    }
  },

  async nextQuestion() {
    const s = this.state;
    const currentQ = s.questions[s.current];
    if (currentQ) await this._retryAnswer(currentQ.id);

    if (s.current < s.questions.length - 1) {
      s.current++;
      this.renderQuestion();
    } else {
      this.finishSimulacro();
    }
  },

  startTimer() {
    const s = this.state;

    // Bug A fix: clear any existing interval before starting a new one
    clearInterval(s.timer);
    s.timer = null;

    // Render immediately so the display shows the correct (possibly restored) time
    const initialDisplay = document.getElementById('timer');
    if (initialDisplay) initialDisplay.textContent = Utils.formatTime(s.timeLeft);

    const storageKey = `preparia_timer_${s.intentoId}`;
    s.timer = setInterval(() => {
      s.timeLeft--;
      // Bug B fix: persist remaining time on every tick
      sessionStorage.setItem(storageKey, s.timeLeft);
      const display = document.getElementById('timer');
      if (display) {
        display.textContent = Utils.formatTime(s.timeLeft);
        display.className   = 'timer-display';
        if (s.timeLeft <= 120) display.classList.add('warning');
        if (s.timeLeft <= 30)  display.classList.add('danger');
      }
      if (s.timeLeft <= 0) this.finishSimulacro();
    }, 1000);
  },

  async finishSimulacro() {
    const s = this.state;
    if (s.finished) return;
    s.finished = true;
    clearInterval(s.timer);
    // Bug B fix: clear sessionStorage when the simulacro ends
    sessionStorage.removeItem(`preparia_timer_${s.intentoId}`);

    const timeUsed = Math.round((Date.now() - s.startTime) / 1000);

    const pending = Object.values(s.failedAnswers);
    if (pending.length) {
      await Promise.allSettled(
        pending.map(f => SimulacrosAPI.responderPregunta(s.intentoId, f.questionId, f.idOpcion))
      );
    }

    try {
      const res   = await SimulacrosAPI.finalizarIntento(s.intentoId, timeUsed);
      const datos = res.datos || res;

      const correctas         = datos.correctas || datos.aciertos || 0;
      const total             = datos.total_preguntas || datos.total || s.questions.length;
      const pct               = datos.porcentaje || Math.round((correctas / total) * 100);
      const retroalimentacion = datos.retroalimentacion || datos.revisiones || datos.respuestas || [];
      const analisis          = datos.analisis || null;

      Simulacros.saveResult({ score: correctas, total, timeUsed, pct });

      if (typeof showPointsToast === 'function' && datos.gamificacion) {
        showPointsToast(datos.gamificacion);
      }

      document.getElementById('simulacro-quiz')?.classList.add('hidden');
      const resultEl = document.getElementById('simulacro-result');
      resultEl?.classList.remove('hidden');

      document.getElementById('result-score-ring').innerHTML = UI.renderScoreRing(pct);
      document.getElementById('result-score-text').innerHTML = `
        <div style="font-size:1.4rem;font-weight:800">${correctas} / ${total} correctas</div>
        <div class="mt-sm" style="color:${Utils.scoreColor(pct)};font-weight:700">${Utils.scoreLabel(pct)}</div>
        <div class="muted mt-sm">Tiempo: ${Utils.formatTime(timeUsed)}</div>
      `;

      this.renderReview(retroalimentacion, analisis, { correctas, total, timeUsed, pct });

    } catch (err) {
      console.error('Error finalizing simulacro:', err);
      if (err.networkError) {
        UI.showToast('Sin conexión. Verifica tu internet.', 'error');
      } else {
        UI.showToast(err.mensaje || 'Error al finalizar el simulacro.', 'error');
      }

      let correct = 0;
      s.questions.forEach(q => { if (s.answers[q.id] === q.correct) correct++; });
      const pct = Math.round((correct / s.questions.length) * 100);

      Simulacros.saveResult({ score: correct, total: s.questions.length, timeUsed, pct });

      document.getElementById('simulacro-quiz')?.classList.add('hidden');
      const resultEl = document.getElementById('simulacro-result');
      resultEl?.classList.remove('hidden');

      document.getElementById('result-score-ring').innerHTML = UI.renderScoreRing(pct);
      document.getElementById('result-score-text').innerHTML = `
        <div style="font-size:1.4rem;font-weight:800">${correct} / ${s.questions.length} correctas</div>
        <div class="mt-sm" style="color:${Utils.scoreColor(pct)};font-weight:700">${Utils.scoreLabel(pct)}</div>
        <div class="muted mt-sm">Tiempo: ${Utils.formatTime(timeUsed)}</div>
      `;

      this.renderReview([], null, { correctas: correct, total: s.questions.length, timeUsed, pct });
    }
  },

  renderReview(retroalimentacion = [], analisis = null, stats = null) {
    this._renderStatsRow(stats);
    if (analisis) {
      this._renderAnalisisDetails(analisis);
    }
    const fbp = analisis ? (analisis.feedback_por_pregunta || []) : retroalimentacion;
    this._renderAccordion(fbp, !!analisis);
  },

  _renderStatsRow(stats) {
    if (!stats) return;
    const el = document.getElementById('result-stats-row');
    if (!el) return;
    const incorrectas = (stats.total || 0) - (stats.correctas || 0);
    el.innerHTML = `
      <div class="result-stat">
        <div class="stat-val" style="color:var(--acid)">${stats.correctas}</div>
        <div class="stat-lbl">Correctas</div>
      </div>
      <div class="result-stat">
        <div class="stat-val" style="color:var(--coral)">${incorrectas}</div>
        <div class="stat-lbl">Incorrectas</div>
      </div>
      <div class="result-stat">
        <div class="stat-val" style="color:var(--sky)">${Utils.formatTime(stats.timeUsed || 0)}</div>
        <div class="stat-lbl">Tiempo</div>
      </div>
    `;
  },

  _renderAnalisisDetails(analisis) {
    const af = analisis.analisis_final || {};

    const mensajeEl = document.getElementById('result-mensaje');
    if (mensajeEl && af.mensaje_general) {
      mensajeEl.textContent = af.mensaje_general;
    }

    const comps = (af.por_competencia || [])
      .filter(c => c.total > 0)
      .sort((a, b) => a.porcentaje - b.porcentaje);
    if (comps.length) {
      const sec = document.getElementById('section-competencias');
      const con = document.getElementById('competencias-container');
      if (sec) sec.style.display = '';
      if (con) con.innerHTML = comps.map(c => this._barCard(c)).join('');
      setTimeout(() => this._animateBars('competencias-container'), 150);
    }

    const temas = (af.por_tema || [])
      .filter(t => t.total > 0)
      .sort((a, b) => a.porcentaje - b.porcentaje);
    if (temas.length) {
      const sec = document.getElementById('section-temas');
      const con = document.getElementById('temas-container');
      if (sec) sec.style.display = '';
      if (con) con.innerHTML = temas.map(t => this._barCard(t)).join('');
      setTimeout(() => this._animateBars('temas-container'), 300);
    }

    const recos = af.recomendaciones || [];
    if (recos.length) {
      const sec = document.getElementById('section-recomendaciones');
      const con = document.getElementById('recomendaciones-container');
      if (sec) sec.style.display = '';
      if (con) con.innerHTML = recos.map(r => `
        <div class="reco-card">
          <div class="reco-card-header">
            <div class="reco-card-icon">💡</div>
            <div>
              <div class="reco-card-name">${Utils.sanitizeHTML(r.nombre || '')}</div>
              <div class="reco-card-tip">${Utils.sanitizeHTML(r.tip || '')}</div>
            </div>
          </div>
        </div>
      `).join('');
    }
  },

  _barCard(item) {
    const NIVELES = ['dominas', 'en_proceso', 'necesita_refuerzo'];
    const nivel   = NIVELES.includes(item.nivel) ? item.nivel : 'en_proceso';
    const labels  = { dominas: 'Dominas', en_proceso: 'En proceso', necesita_refuerzo: 'Necesita refuerzo' };
    const pbClass = item.porcentaje >= 80 ? 'pb-green' : item.porcentaje >= 60 ? 'pb-yellow' : 'pb-red';
    const name    = item.nombre || item.tema || '';
    return `
      <div class="analisis-card">
        <div class="analisis-card-header">
          <div>
            <div class="analisis-card-name">${Utils.sanitizeHTML(name)}</div>
            <div class="analisis-card-stats">${item.correctas} / ${item.total} correctas</div>
          </div>
          <span class="nivel-badge nivel-${nivel}">${labels[nivel]}</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar-fill ${pbClass}" data-target="${item.porcentaje}" style="width:0%"></div>
        </div>
        <div style="text-align:right;font-size:0.75rem;margin-top:4px;color:rgba(245,245,240,0.4)">${item.porcentaje}%</div>
      </div>
    `;
  },

  _animateBars(containerId) {
    const con = document.getElementById(containerId);
    if (!con) return;
    con.querySelectorAll('.progress-bar-fill[data-target]').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  },

  _renderAccordion(items, isAnalisis) {
    const s         = this.state;
    const container = document.getElementById('review-container');
    if (!container) return;

    if (!items || !items.length) {
      if (!isAnalisis) {
        container.innerHTML = s.questions.map((q, i) => {
          const userAns = s.answers[q.id];
          const short   = q.text.length > 72 ? q.text.substring(0, 72) + '…' : q.text;
          return `
            <div class="accordion-item" id="acc-${i}">
              <button class="accordion-trigger" onclick="PageSimulacros.toggleAccordion(${i})" aria-expanded="false">
                <span class="accordion-icon">📝</span>
                <span class="accordion-label">Pregunta ${i + 1} · ${Utils.sanitizeHTML(short)}</span>
                <span class="accordion-arrow">▼</span>
              </button>
              <div class="accordion-body">
                <div class="options-list">
                  ${q.options.map((opt, oi) => {
                    const text = typeof opt === 'string' ? opt : opt.text;
                    return `<div class="option-item ${oi === userAns ? 'selected' : ''}">
                      <div class="option-letter">${String.fromCharCode(65 + oi)}</div>
                      <div>${Utils.sanitizeHTML(text)}</div>
                    </div>`;
                  }).join('')}
                </div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        container.innerHTML = '<p style="color:rgba(245,245,240,0.35);text-align:center;padding:20px">No hay revisión detallada disponible.</p>';
      }
      return;
    }

    const sorted = isAnalisis
      ? [...items.filter(p => !p.es_correcta), ...items.filter(p => p.es_correcta)]
      : [...items.filter(p => !(p.es_correcta || p.correcta)), ...items.filter(p => p.es_correcta || p.correcta)];

    container.innerHTML = sorted.map((p, i) => {
      const isOk = p.es_correcta || p.correcta || false;

      if (isAnalisis) {
        const qState = s.questions.find(q => q.id === p.id_pregunta);
        const enunciado = qState ? qState.text : `Pregunta ${p.id_pregunta}`;
        const short = enunciado.length > 75 ? enunciado.substring(0, 75) + '…' : enunciado;
        const body = isOk ? `
          <p style="color:rgba(191,255,0,0.85);font-size:0.88rem;margin-bottom:8px">✓ Respondiste correctamente.</p>
          ${p.concepto_clave ? `<span class="concepto-badge">📌 ${Utils.sanitizeHTML(p.concepto_clave)}</span><br>` : ''}
          ${p.explicacion_completa ? `<div class="explicacion-block">${Utils.sanitizeHTML(p.explicacion_completa)}</div>` : ''}
        ` : `
          <div class="answer-comparison">
            <div class="answer-box wrong-ans">
              <div class="ans-label">Tu respuesta${p.letra_elegida ? ` (${p.letra_elegida})` : ''}</div>
              <div>${Utils.sanitizeHTML(p.texto_elegido || '—')}</div>
            </div>
            <div class="answer-box right-ans">
              <div class="ans-label">Respuesta correcta${p.letra_correcta ? ` (${p.letra_correcta})` : ''}</div>
              <div>${Utils.sanitizeHTML(p.texto_correcto || '—')}</div>
            </div>
          </div>
          ${p.error_conceptual ? `<span class="error-badge">⚠ ${Utils.sanitizeHTML(p.error_conceptual)}</span><br>` : ''}
          ${p.concepto_clave ? `<span class="concepto-badge">📌 ${Utils.sanitizeHTML(p.concepto_clave)}</span><br>` : ''}
          ${p.explicacion_completa ? `<div class="explicacion-block">${Utils.sanitizeHTML(p.explicacion_completa)}</div>` : ''}
        `;
        return `
          <div class="accordion-item ${isOk ? 'correct' : 'incorrect'}" id="acc-${i}">
            <button class="accordion-trigger" onclick="PageSimulacros.toggleAccordion(${i})" aria-expanded="false">
              <span class="accordion-icon">${isOk ? '✅' : '❌'}</span>
              <span class="accordion-label">${Utils.sanitizeHTML(short)}</span>
              <span class="accordion-arrow">▼</span>
            </button>
            <div class="accordion-body">${body}</div>
          </div>
        `;
      }

      const pregunta     = p.enunciado || p.pregunta || p.texto || `Pregunta ${i + 1}`;
      const preguntaShort = pregunta.length > 75 ? pregunta.substring(0, 75) + '…' : pregunta;
      const opciones     = p.opciones || [];
      const explicacion  = p.explicacion || p.retroalimentacion || '';
      const textoBase    = p.texto_base ?? p.contexto ?? '';
      return `
        <div class="accordion-item ${isOk ? 'correct' : 'incorrect'}" id="acc-${i}">
          <button class="accordion-trigger" onclick="PageSimulacros.toggleAccordion(${i})" aria-expanded="false">
            <span class="accordion-icon">${isOk ? '✅' : '❌'}</span>
            <span class="accordion-label">${Utils.sanitizeHTML(preguntaShort)}</span>
            <span class="accordion-arrow">▼</span>
          </button>
          <div class="accordion-body">
            ${textoBase ? `<div class="question-context" style="margin-bottom:10px">${Utils.sanitizeHTML(textoBase)}</div>` : ''}
            <div style="font-size:0.9rem;margin-bottom:10px;color:rgba(245,245,240,0.85)">${Utils.sanitizeHTML(pregunta)}</div>
            ${opciones.length ? `<div class="options-list">
              ${opciones.map((opt, oi) => `
                <div class="option-item ${opt.es_correcta ? 'correct' : ''} ${opt.seleccionada && !opt.es_correcta ? 'wrong' : ''}">
                  <div class="option-letter">${String.fromCharCode(65 + oi)}</div>
                  <div>${Utils.sanitizeHTML(opt.texto || opt.text || opt.contenido || '')}</div>
                </div>`).join('')}
            </div>` : ''}
            ${!isOk && explicacion ? `<div class="alert alert-info mt-md">💡 ${Utils.sanitizeHTML(explicacion)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  toggleAccordion(index) {
    const item = document.getElementById(`acc-${index}`);
    if (!item) return;
    const isOpen = item.classList.contains('open');
    item.classList.toggle('open', !isOpen);
    const trigger = item.querySelector('.accordion-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', String(!isOpen));
  },

  renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;
    const history = Simulacros.getHistory();
    if (!history.length) {
      container.innerHTML = '<p style="color:rgba(245,245,240,0.3);text-align:center;padding:20px 0">Aún no hay simulacros registrados.</p>';
      return;
    }
    container.innerHTML = history.slice(0, 5).map(h => `
      <div class="flex items-center justify-between" style="padding:12px 0;border-bottom:1px solid rgba(245,245,240,0.07)">
        <div>
          <div style="font-weight:600;font-size:0.88rem">${h.date}</div>
          <div class="muted">${h.score}/${h.total} correctas</div>
        </div>
        <div style="font-size:1.3rem;font-weight:800;color:${Utils.scoreColor(h.pct)}">${h.pct}%</div>
      </div>
    `).join('');
  },

  retake() {
    document.getElementById('simulacro-result')?.classList.add('hidden');
    document.getElementById('simulacro-start')?.classList.remove('hidden');

    const s = this.state;
    s.intentoId  = null;
    s.questions  = [];
    s.current    = 0;
    s.answers    = {};
    s.finished   = false;

    const btn = document.getElementById('start-btn');
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Iniciar simulacro'; }
  }
};
