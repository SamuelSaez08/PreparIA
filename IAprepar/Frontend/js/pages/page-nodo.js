'use strict';

const PageNodo = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    const hash = window.location.hash.replace('#', '');
    const hashParams = new URLSearchParams(hash);
    const nodeId = hashParams.get('id') || new URLSearchParams(window.location.search).get('id');
    console.log('[DEBUG nodo] URL:', window.location.href);
    console.log('[DEBUG nodo] nodeId:', nodeId);
    console.log('[DEBUG nodo] tree en localStorage:', TreeManager.getTree().length, 'nodos raíz');

    if (!nodeId) { window.location.href = 'ciencias-sociales.html'; return; }

    // Cargar árbol del backend solo si no está en localStorage
    if (!TreeManager.getTree().length) {
      console.log('[DEBUG nodo] Árbol vacío, cargando del backend...');
      try {
        const res = await NodosAPI.getArbol(1);
        const datos = res.datos || res;
        const backendTree = Array.isArray(datos) ? datos : (datos.hijos || datos.nodos || [datos]);
        TreeManager.setTreeFromBackend(backendTree);
        console.log('[DEBUG nodo] Árbol cargado del backend:', TreeManager.getTree().length, 'nodos raíz');
      } catch (err) {
        console.warn('[DEBUG nodo] Error cargando árbol del backend:', err);
      }
    }

    let node = TreeManager.getNodeById(nodeId);
    console.log('[DEBUG nodo] getNodeById(' + nodeId + '):', node ? node.label : 'null - no encontrado');

    if (!node) {
      console.log('[DEBUG nodo] Intentando getNodo individual...');
      try {
        const res = await NodosAPI.getNodo(nodeId);
        const raw = res.datos || res;
        console.log('[DEBUG nodo] getNodo respuesta raw:', raw);
        node = {
          id: raw.id,
          label: raw.nombre || 'Sin nombre',
          icon: raw.icono || raw.descripcion || '📌',
          description: '',
          children: [],
        };
      } catch (err) {
        console.error('[DEBUG nodo] getNodo falló:', err);
        this.showError('No se encontró el nodo solicitado.');
        return;
      }
    }

    this.renderHeader(node, nodeId);
    await this.loadContent(node, nodeId);
    this.renderChildren(node);
    this.renderNavigation(nodeId);
  },

  renderHeader(node, nodeId) {
    const iconEl = document.getElementById('node-icon');
    const titleEl = document.getElementById('node-title');
    const breadcrumbEl = document.getElementById('breadcrumb-current');
    const metaEl = document.getElementById('node-meta');

    if (iconEl) iconEl.textContent = node.icon || '📌';
    if (titleEl) titleEl.textContent = node.label;
    if (breadcrumbEl) breadcrumbEl.textContent = node.label;

    const path = this.findPath(nodeId);
    if (path.length > 1) {
      const breadcrumbContainer = document.getElementById('node-breadcrumb');
      if (breadcrumbContainer) {
        breadcrumbContainer.innerHTML = `
          <a href="dashboard.html" class="crumb">Inicio</a>
          <span class="crumb-sep">→</span>
          <a href="ciencias-sociales.html" class="crumb">Ciencias Sociales</a>
          ${path.slice(0, -1).map(p => `
            <span class="crumb-sep">→</span>
            <a href="nodo.html#id=${encodeURIComponent(p.id)}" class="crumb">${p.label}</a>
          `).join('')}
          <span class="crumb-sep">→</span>
          <span class="crumb active">${node.label}</span>
        `;
      }
    }

    if (metaEl) {
      const chips = [];
      const hasChildren = node.children && node.children.length > 0;
      if (hasChildren) {
        chips.push(`<span class="node-meta-chip">📂 ${node.children.length} subtema${node.children.length > 1 ? 's' : ''}</span>`);
      } else {
        chips.push(`<span class="node-meta-chip">📄 Tema de estudio</span>`);
      }
      if (node.custom) chips.push(`<span class="node-meta-chip custom">✨ Nodo personalizado</span>`);
      metaEl.innerHTML = chips.join('');
    }

    document.title = `PreparIA — ${node.label}`;
  },

  findPath(nodeId) {
    const tree = TreeManager.getTree();
    const path = [];
    const search = (nodes, trail) => {
      for (const n of nodes) {
        const currentTrail = [...trail, { id: n.id, label: n.label, icon: n.icon }];
        if (String(n.id) === String(nodeId)) { path.push(...currentTrail); return true; }
        if (n.children && search(n.children, currentTrail)) return true;
      }
      return false;
    };
    search(tree, []);
    return path;
  },

  async loadContent(node, nodeId) {
    const contentArea = document.getElementById('node-content-area');
    if (!contentArea) return;

    const esNodoBackend = typeof node.id === 'number' || !isNaN(parseInt(nodeId));
    console.log('[DEBUG loadContent] node.id:', node.id, typeof node.id, '| nodeId param:', nodeId, '| esNodoBackend:', esNodoBackend);

    if (!esNodoBackend) {
      // Nodo local sin ID numérico
      contentArea.innerHTML = node.description
        ? `<div class="node-content-card"><div class="node-content-text">${this.formatContent(node.description)}</div></div>`
        : this._emptyContent('Sin contenido disponible', 'Este es un nodo del árbol sin material asignado.');
      return;
    }

    // Mostrar skeleton mientras carga
    contentArea.innerHTML = `
      <div class="node-content-card" style="opacity:0.4">
        <div style="height:1rem;background:rgba(255,255,255,0.1);border-radius:4px;margin-bottom:12px;width:60%"></div>
        <div style="height:0.8rem;background:rgba(255,255,255,0.07);border-radius:4px;margin-bottom:8px"></div>
        <div style="height:0.8rem;background:rgba(255,255,255,0.07);border-radius:4px;margin-bottom:8px;width:80%"></div>
        <div style="height:0.8rem;background:rgba(255,255,255,0.07);border-radius:4px;width:90%"></div>
      </div>`;

    try {
      const res = await NodosAPI.getMaterial(nodeId);
      console.log('[DEBUG loadContent] respuesta getMaterial:', res);

      const materiales = (res && res.datos) ? res.datos : [];
      console.log('[DEBUG loadContent] materiales.length:', materiales.length);

      if (materiales.length === 0) {
        const hasChildren = node.children && node.children.length > 0;
        if (hasChildren) {
          contentArea.innerHTML = ''; // los hijos se renderizan abajo en renderChildren
        } else if (node.description) {
          contentArea.innerHTML = `<div class="node-content-card"><div class="node-content-text">${this.formatContent(node.description)}</div></div>`;
        } else {
          contentArea.innerHTML = this._emptyContent('Sin contenido disponible', 'Este nodo aún no tiene material de estudio asignado.');
        }
        return;
      }

      // Separar por tipo
      const teoria = materiales.find(m => m.tipo === 'teoria');
      const ejemplo = materiales.find(m => m.tipo === 'ejemplo');
      const tip = materiales.find(m => m.tipo === 'tip_icfes');

      contentArea.innerHTML = `
        ${teoria ? `
          <div class="node-content-card">
            <h4 style="margin-bottom:12px;font-size:1rem;color:var(--accent)">
              📖 ${Utils.sanitizeHTML(teoria.titulo || 'Teoría')}
            </h4>
            <div class="node-content-text">${this.formatContent(teoria.contenido)}</div>
          </div>` : ''}

        ${ejemplo ? `
          <div class="node-content-card" style="border-left:3px solid var(--accent)">
            <h4 style="margin-bottom:12px;font-size:1rem;color:var(--accent)">
              💡 ${Utils.sanitizeHTML(ejemplo.titulo || 'Ejemplo')}
            </h4>
            <div class="node-content-text">${this.formatContent(ejemplo.contenido)}</div>
          </div>` : ''}

        ${tip ? `
          <div class="node-content-card" style="border-left:3px solid var(--coral);background:rgba(255,107,79,0.06)">
            <h4 style="margin-bottom:12px;font-size:1rem;color:var(--coral)">
              🎯 ${Utils.sanitizeHTML(tip.titulo || 'Cómo pregunta el ICFES')}
            </h4>
            <div class="node-content-text">${this.formatContent(tip.contenido)}</div>
          </div>` : ''}
      `;

    } catch (err) {
      console.error('[DEBUG loadContent] Error:', err);
      contentArea.innerHTML = `
        <div class="node-empty">
          <div class="empty-icon">⚠️</div>
          <p style="font-weight:600;font-size:1.05rem;color:var(--coral);margin-bottom:8px;">Error al cargar el contenido</p>
          <p style="font-size:0.9rem">${err.mensaje || 'No se pudo conectar con el servidor.'}</p>
          <button onclick="location.reload()" class="btn btn-ghost btn-sm" style="margin-top:16px">🔄 Reintentar</button>
        </div>`;
    }
  },

  _emptyContent(title, body) {
    return `
      <div class="node-empty">
        <div class="empty-icon">📭</div>
        <p style="font-weight:600;font-size:1.05rem;margin-bottom:8px;">${title}</p>
        <p style="font-size:0.9rem">${body}</p>
      </div>`;
  },

  formatContent(text) {
    if (!text) return '';
    return text.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  },

  renderChildren(node) {
    if (!node.children || !node.children.length) return;

    const section = document.getElementById('node-children-section');
    const list = document.getElementById('node-children-list');
    if (!section || !list) return;

    section.style.display = 'block';
    list.innerHTML = node.children.map(child => {
      const hasGrandchildren = child.children && child.children.length > 0;
      return `
        <a href="nodo.html#id=${encodeURIComponent(child.id)}" class="node-child-item">
          <div class="node-child-icon">${child.icon || '📌'}</div>
          <div>
            <div class="node-child-label">${child.label}</div>
            ${hasGrandchildren ? `<div class="muted" style="font-size:0.78rem;margin-top:2px">${child.children.length} subtema${child.children.length > 1 ? 's' : ''}</div>` : ''}
            ${child.custom ? '<span class="badge badge-sky" style="font-size:0.6rem;margin-top:4px">Custom</span>' : ''}
          </div>
          <div class="node-child-arrow">→</div>
        </a>
      `;
    }).join('');
  },

  showError(message) {
    const contentArea = document.getElementById('node-content-area');
    const heroEl = document.getElementById('node-hero');
    if (heroEl) heroEl.style.display = 'none';
    if (contentArea) {
      contentArea.innerHTML = `
        <div class="node-empty">
          <div class="empty-icon">😕</div>
          <p style="font-weight:600;font-size:1.05rem;margin-bottom:8px;">${message}</p>
          <a href="ciencias-sociales.html" class="btn btn-ghost btn-sm" style="margin-top:16px">← Volver al árbol</a>
        </div>`;
    }
  },

  getFlattenedTree() {
    const flat = [];
    const traverse = (nodes) => {
      for (const n of nodes) {
        flat.push(n);
        if (n.children && n.children.length > 0) traverse(n.children);
      }
    };
    traverse(TreeManager.getTree());
    return flat;
  },

  renderNavigation(nodeId) {
    const flat = this.getFlattenedTree();
    const idx = flat.findIndex(n => String(n.id) === String(nodeId));

    const navContainer = document.getElementById('node-navigation');
    const btnPrev = document.getElementById('btn-prev-node');
    const btnNext = document.getElementById('btn-next-node');

    if (!navContainer || idx === -1) return;

    navContainer.style.display = 'flex';

    if (idx > 0) {
      const prev = flat[idx - 1];
      btnPrev.style.visibility = 'visible';
      btnPrev.innerHTML = `← ${Utils.sanitizeHTML(prev.label)}`;
      btnPrev.onclick = () => window.location.href = `nodo.html#id=${encodeURIComponent(prev.id)}`;
    } else {
      btnPrev.style.visibility = 'hidden';
    }

    if (idx < flat.length - 1) {
      const next = flat[idx + 1];
      btnNext.style.visibility = 'visible';
      btnNext.innerHTML = `${Utils.sanitizeHTML(next.label)} →`;
      btnNext.onclick = () => window.location.href = `nodo.html#id=${encodeURIComponent(next.id)}`;
    } else {
      btnNext.style.visibility = 'hidden';
    }
  },
};