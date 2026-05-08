'use strict';

const PageNodo = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    const params = new URLSearchParams(window.location.search);
    const nodeId = params.get('id');

    if (!nodeId) { this.showError('No se especificó un nodo.'); return; }

    State.remove(State.KEYS.TREE_NODES);

    try {
      const res         = await NodosAPI.getArbol(1);
      const datos       = res.datos || res;
      const backendTree = Array.isArray(datos) ? datos : (datos.hijos || datos.nodos || [datos]);
      TreeManager.setTreeFromBackend(backendTree);
    } catch (err) {
      console.warn('Could not load tree from backend:', err);
    }

    const node = TreeManager.getNodeById(nodeId);
    if (!node) { this.showError('No se encontró el nodo solicitado.'); return; }

    this.renderHeader(node, nodeId);
    await this.loadContent(node, nodeId);
    this.renderChildren(node);
    this.renderNavigation(nodeId);
  },

  renderHeader(node, nodeId) {
    const iconEl       = document.getElementById('node-icon');
    const titleEl      = document.getElementById('node-title');
    const breadcrumbEl = document.getElementById('breadcrumb-current');
    const metaEl       = document.getElementById('node-meta');

    if (iconEl)       iconEl.textContent       = node.icon || '📌';
    if (titleEl)      titleEl.textContent       = node.label;
    if (breadcrumbEl) breadcrumbEl.textContent  = node.label;

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
            <a href="nodo.html?id=${encodeURIComponent(p.id)}" class="crumb">${p.label}</a>
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

    try {
      if (typeof node.id === 'number' || !isNaN(parseInt(nodeId))) {
        const res        = await NodosAPI.getMaterial(nodeId);
        const materiales = res.datos || [];

        if (materiales.length > 0) {
          contentArea.innerHTML = materiales.map(m => `
            <div class="node-content-card">
              ${m.titulo ? `<h4>${m.titulo}</h4>` : ''}
              <div class="node-content-text">${this.formatContent(m.contenido)}</div>
            </div>
          `).join('');
        } else if (node.description) {
          contentArea.innerHTML = `
            <div class="node-content-card">
              <div class="node-content-text">${this.formatContent(node.description)}</div>
            </div>`;
        } else {
          contentArea.innerHTML = this._emptyContent('Sin contenido disponible', 'Este nodo aún no tiene material de estudio asignado.');
        }
      } else {
        if (node.description) {
          contentArea.innerHTML = `
            <div class="node-content-card">
              <div class="node-content-text">${this.formatContent(node.description)}</div>
            </div>`;
        } else {
          contentArea.innerHTML = this._emptyContent('Sin contenido disponible', 'Este es un nodo del árbol sin material asignado.');
        }
      }
    } catch (err) {
      console.error('Error loading node content:', err);
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
    const list    = document.getElementById('node-children-list');
    if (!section || !list) return;

    section.style.display = 'block';
    list.innerHTML = node.children.map(child => {
      const hasGrandchildren = child.children && child.children.length > 0;
      return `
        <a href="nodo.html?id=${encodeURIComponent(child.id)}" class="node-child-item">
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
    const heroEl      = document.getElementById('node-hero');
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
    const flat     = [];
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
    const idx  = flat.findIndex(n => String(n.id) === String(nodeId));

    const navContainer = document.getElementById('node-navigation');
    const btnPrev      = document.getElementById('btn-prev-node');
    const btnNext      = document.getElementById('btn-next-node');

    if (!navContainer || idx === -1) return;

    navContainer.style.display = 'flex';

    if (idx > 0) {
      const prev = flat[idx - 1];
      btnPrev.style.visibility = 'visible';
      btnPrev.innerHTML        = `← ${Utils.sanitizeHTML(prev.label)}`;
      btnPrev.onclick = () => window.location.href = `nodo.html?id=${encodeURIComponent(prev.id)}`;
    } else {
      btnPrev.style.visibility = 'hidden';
    }

    if (idx < flat.length - 1) {
      const next = flat[idx + 1];
      btnNext.style.visibility = 'visible';
      btnNext.innerHTML        = `${Utils.sanitizeHTML(next.label)} →`;
      btnNext.onclick = () => window.location.href = `nodo.html?id=${encodeURIComponent(next.id)}`;
    } else {
      btnNext.style.visibility = 'hidden';
    }
  },
};
