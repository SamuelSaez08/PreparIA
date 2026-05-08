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
    const s       = this.state;
    const display = document.getElementById('timer');
    s.timer = setInterval(() => {
      s.timeLeft--;
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

      const correctas        = datos.correctas || datos.aciertos || 0;
      const total            = datos.total_preguntas || datos.total || s.questions.length;
      const pct              = datos.porcentaje || Math.round((correctas / total) * 100);
      const retroalimentacion = datos.retroalimentacion || datos.revisiones || datos.respuestas || [];

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

      this.renderReview(retroalimentacion);

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

      this.renderReview([]);
    }
  },

  renderReview(retroalimentacion = []) {
    const s         = this.state;
    const container = document.getElementById('review-container');
    if (!container) return;

    if (retroalimentacion.length) {
      container.innerHTML = retroalimentacion.map((r, qi) => {
        const pregunta   = r.enunciado || r.pregunta || r.texto || `Pregunta ${qi + 1}`;
        const isCorrect  = r.es_correcta || r.correcta || false;
        const opciones   = r.opciones || [];
        const explicacion = r.explicacion || r.retroalimentacion || '';
        const textoBase  = r.texto_base ?? r.contexto ?? '';

        return `
          <div class="question-card no-hover" style="margin-bottom:16px">
            <div class="question-number">Pregunta ${qi + 1} · ${isCorrect ? '✅ Correcta' : '❌ Incorrecta'}</div>
            ${textoBase ? `<div class="question-context">${Utils.sanitizeHTML(textoBase)}</div>` : ''}
            <div class="question-text">${Utils.sanitizeHTML(pregunta)}</div>
            ${opciones.length ? `
              <div class="options-list">
                ${opciones.map((opt, i) => {
                  const esCorrecta     = opt.es_correcta || false;
                  const fueSeleccionada = opt.seleccionada || false;
                  return `
                    <div class="option-item ${esCorrecta ? 'correct' : ''} ${fueSeleccionada && !esCorrecta ? 'wrong' : ''}">
                      <div class="option-letter">${String.fromCharCode(65 + i)}</div>
                      <div>${Utils.sanitizeHTML(opt.texto || opt.text || opt.contenido)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
            ${!isCorrect && explicacion ? `<div class="alert alert-info mt-md">💡 ${Utils.sanitizeHTML(explicacion)}</div>` : ''}
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = s.questions.map((q, qi) => {
        const userAns = s.answers[q.id];
        return `
          <div class="question-card no-hover" style="margin-bottom:16px">
            <div class="question-number">Pregunta ${qi + 1} · ${Utils.sanitizeHTML(q.tema)}</div>
            ${q.texto_base ? `<div class="question-context">${Utils.sanitizeHTML(q.texto_base)}</div>` : ''}
            <div class="question-text">${Utils.sanitizeHTML(q.text)}</div>
            <div class="options-list">
              ${q.options.map((opt, i) => {
                const text = typeof opt === 'string' ? opt : opt.text;
                return `
                  <div class="option-item ${i === userAns ? 'selected' : ''}">
                    <div class="option-letter">${String.fromCharCode(65 + i)}</div>
                    <div>${Utils.sanitizeHTML(text)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }
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
