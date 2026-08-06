'use strict';

const PageNodo = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    const rawHash = window.location.hash.replace('#', '').trim();
    let nodeId = null;
    if (rawHash) {
      if (rawHash.includes('=')) {
        nodeId = new URLSearchParams(rawHash).get('id');
      } else {
        nodeId = rawHash;
      }
    }
    if (!nodeId) {
      nodeId = new URLSearchParams(window.location.search).get('id');
    }

    console.log('[DEBUG nodo] URL:', window.location.href);
    console.log('[DEBUG nodo] nodeId:', nodeId);

    if (!nodeId) { window.location.href = 'ciencias-sociales.html'; return; }

    // Cargar árbol del backend si no está cargado o si es la primera entrada
    if (!TreeManager.getTree().length) {
      console.log('[DEBUG nodo] Árbol vacío en local, cargando del backend...');
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

    // Si aún no se encuentra en el árbol local, forzar recarga del árbol completo
    if (!node) {
      console.log('[DEBUG nodo] Node no encontrado en árbol local, reintentando recargar árbol del backend...');
      try {
        const res = await NodosAPI.getArbol(1);
        const datos = res.datos || res;
        const backendTree = Array.isArray(datos) ? datos : (datos.hijos || datos.nodos || [datos]);
        TreeManager.setTreeFromBackend(backendTree);
        node = TreeManager.getNodeById(nodeId);
      } catch (err) {
        console.warn('[DEBUG nodo] Error reintentando recargar árbol:', err);
      }
    }

    if (!node) {
      console.log('[DEBUG nodo] Intentando getNodo individual...');
      try {
        // Fetch individual node info
        const res = await NodosAPI.getNodo(nodeId);
        const raw = res.datos || res;
        console.log('[DEBUG nodo] getNodo respuesta raw:', raw);

        // Also fetch children of this node from backend
        let hijosTransformed = [];
        try {
          const hijosRes = await NodosAPI.getNodos({ padre: nodeId });
          const hijosRaw = (hijosRes && hijosRes.datos) ? hijosRes.datos : [];
          console.log('[DEBUG nodo] hijos del nodo:', hijosRaw.length);
          hijosTransformed = hijosRaw.map(h => ({
            id: h.id,
            label: h.nombre || 'Sin nombre',
            icon: (h.icono && h.icono.length <= 4) ? h.icono : (h.descripcion && h.descripcion.length <= 4 ? h.descripcion : '📌'),
            description: h.descripcion || '',
            children: [],
          }));
        } catch (hijosErr) {
          console.warn('[DEBUG nodo] No se pudieron cargar hijos:', hijosErr);
        }

        node = {
          id: raw.id,
          label: raw.nombre || 'Sin nombre',
          icon: (raw.icono && raw.icono.length <= 4) ? raw.icono : (raw.descripcion && raw.descripcion.length <= 4 ? raw.descripcion : '📌'),
          description: raw.descripcion || '',
          children: hijosTransformed,
        };
      } catch (err) {
        console.error('[DEBUG nodo] getNodo falló:', err);
        this.showError('No se encontró el nodo solicitado.');
        return;
      }
    }

    if (!this._hashListenerAdded) {
      this._hashListenerAdded = true;
      window.addEventListener('hashchange', () => this.init());
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

    const hasValidDesc = node.description && node.description.trim().length > 4;

    if (!esNodoBackend) {
      // Nodo local sin ID numérico
      contentArea.innerHTML = hasValidDesc
        ? `<div class="node-content-card"><div class="node-content-text">${this.formatContent(node.description)}</div></div>`
        : (node.children && node.children.length ? '' : this._emptyContent('Sin contenido disponible', 'Este es un nodo del árbol sin material asignado.'));
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
          contentArea.innerHTML = hasValidDesc
            ? `<div class="node-content-card"><div class="node-content-text">${this.formatContent(node.description)}</div></div>`
            : ''; // los hijos se renderizan abajo en renderChildren
        } else if (hasValidDesc) {
          contentArea.innerHTML = `<div class="node-content-card"><div class="node-content-text">${this.formatContent(node.description)}</div></div>`;
        } else {
          contentArea.innerHTML = this._emptyContent('Sin contenido disponible', 'Este nodo aún no tiene material de estudio asignado.');
        }
        return;
      }

      // Renderizar materiales
      let html = '';
      materiales.forEach(mat => {
        const titulo = Utils.sanitizeHTML(mat.titulo || 'Material de Estudio');
        const contenidoFormatted = this.formatContent(mat.contenido || mat.cuerpo || '');

        if (mat.tipo === 'ejemplo') {
          html += `
            <div class="node-content-card" style="border-left:3px solid var(--accent)">
              <h4 style="margin-bottom:12px;font-size:1rem;color:var(--accent)">
                💡 ${titulo}
              </h4>
              <div class="node-content-text">${contenidoFormatted}</div>
            </div>`;
        } else if (mat.tipo === 'tip_icfes') {
          html += `
            <div class="node-content-card" style="border-left:3px solid var(--coral);background:rgba(255,107,79,0.06)">
              <h4 style="margin-bottom:12px;font-size:1rem;color:var(--coral)">
                🎯 ${titulo}
              </h4>
              <div class="node-content-text">${contenidoFormatted}</div>
            </div>`;
        } else {
          // 'teoria', 'texto', o cualquier otro tipo
          html += `
            <div class="node-content-card">
              <h4 style="margin-bottom:12px;font-size:1rem;color:var(--accent)">
                📖 ${titulo}
              </h4>
              <div class="node-content-text">${contenidoFormatted}</div>
            </div>`;
        }
      });

      contentArea.innerHTML = html;

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
    const section = document.getElementById('node-children-section');
    const list = document.getElementById('node-children-list');
    if (!section || !list) return;

    if (!node.children || !node.children.length) {
      section.style.display = 'none';
      list.innerHTML = '';
      return;
    }

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