'use strict';

const PageCienciasSociales = {
  selectedNodeId: null,
  isAdmin: false,
  vista: 'ruta',          // 'ruta' | 'arbol'
  progresoNodos: [],

  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();
    UI.initModalCloseHandlers();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());
    document.getElementById('save-node-btn')?.addEventListener('click', () => this.addNewNode());
    document.getElementById('reset-tree-btn')?.addEventListener('click', () => {
      if (confirm('¿Reiniciar el árbol al estado original? Se perderán los nodos personalizados.')) {
        State.remove(State.KEYS.TREE_NODES);
        this.loadTree();
        UI.showToast('Árbol reiniciado.');
      }
    });

    const user = Auth.getUser();
    this.isAdmin = user && user.rol === 'admin';

    const addNodeCard = document.getElementById('add-node-card');
    if (addNodeCard && this.isAdmin) addNodeCard.style.display = 'flex';

    this.montarConmutador();

    State.remove(State.KEYS.TREE_NODES);
    await this.loadTree();
  },

  /* ────────────────────────────────────────────────────────────
     Conmutador Ruta / Árbol
     La ruta es la vista por defecto para el estudiante; el árbol
     conserva el buscador y las herramientas de administración.
  ──────────────────────────────────────────────────────────── */
  montarConmutador() {
    const btnRuta  = document.getElementById('btn-vista-ruta');
    const btnArbol = document.getElementById('btn-vista-arbol');
    if (!btnRuta || !btnArbol) return;

    // El administrador entra directo al árbol: es donde puede editar.
    const guardada = State.get('preparia_vista_contenidos');
    this.vista = guardada || (this.isAdmin ? 'arbol' : 'ruta');

    const aplicar = (vista) => {
      this.vista = vista;
      State.set('preparia_vista_contenidos', vista);

      document.getElementById('vista-ruta').hidden  = vista !== 'ruta';
      document.getElementById('vista-arbol').hidden = vista !== 'arbol';

      btnRuta.classList.toggle('activa', vista === 'ruta');
      btnArbol.classList.toggle('activa', vista === 'arbol');
      btnRuta.setAttribute('aria-selected', String(vista === 'ruta'));
      btnArbol.setAttribute('aria-selected', String(vista === 'arbol'));

      // Con la vista oculta los nodos miden 0: hay que redibujar el trazo
      // en cuanto vuelve a ser visible.
      if (vista === 'ruta') requestAnimationFrame(() => RutaAprendizaje.refrescar());
    };

    btnRuta.addEventListener('click', () => aplicar('ruta'));
    btnArbol.addEventListener('click', () => aplicar('arbol'));
    aplicar(this.vista);
  },

  /** Dominio real por tema, calculado en el servidor. */
  async cargarProgresoNodos() {
    try {
      const res = await ProgresoAPI.getProgresoNodos(1);
      this.progresoNodos = (res.datos && res.datos.nodos) || [];
    } catch (err) {
      // La ruta se dibuja igual: sin datos, todos los temas salen
      // como "sin practicar" en vez de romper la página.
      console.warn('No se pudo cargar el progreso por nodo:', err);
      this.progresoNodos = [];
    }
  },

  renderRuta() {
    const contenedor = document.getElementById('ruta-container');
    if (!contenedor) return;
    RutaAprendizaje.render(contenedor, TreeManager.getTree(), this.progresoNodos);
  },

  async loadTree() {
    try {
      const res = await NodosAPI.getArbol(1);
      const datos = res.datos || res;
      const backendTree = Array.isArray(datos) ? datos : (datos.hijos || datos.nodos || [datos]);
      TreeManager.setTreeFromBackend(backendTree);
    } catch (err) {
      console.warn('NodosAPI.getArbol failed, using local tree:', err);
      if (err.networkError) UI.showToast('Sin conexión. Mostrando datos locales.', 'error');
    }

    await this.cargarProgresoNodos();
    this.renderTree();
    this.renderRuta();
  },

  renderTree() {
    const container = document.getElementById('tree-container');
    if (!container) return;
    const tree = TreeManager.getTree();

    if (!tree || !tree.length) {
      container.innerHTML = `
        <div class="text-center" style="padding:60px 20px;color:rgba(245,245,240,0.3)">
          <div style="font-size:3rem;margin-bottom:12px">🌱</div>
          <p>El árbol de contenidos está vacío.</p>
          <button onclick="PageCienciasSociales.loadTree()" class="btn btn-ghost btn-sm mt-md">🔄 Recargar</button>
        </div>`;
      return;
    }

    container.innerHTML = tree.map(node => this.renderNode(node, 0)).join('');
    this.setupInlineEditListeners();
  },

  renderNode(node, level) {
    const hasChildren = node.children && node.children.length > 0;
    const levelClass = `level-${Math.min(level, 3)}`;
    const leafClass = !hasChildren ? 'tree-leaf' : '';
    const id = String(node.id);

    const addChildBtn = this.isAdmin
      ? `<button class="tree-add-child-btn" data-add-child="${id}" title="Agregar subtema">+</button>`
      : '';

    return `
      <div class="tree-node ${levelClass} ${leafClass}" id="node-${id}" data-node-id="${id}">
        <div class="tree-node-header" data-navigate-id="${id}">
          ${hasChildren ? `<div class="tree-toggle" data-toggle-id="${id}">▶</div>` : '<div style="width:22px"></div>'}
          <span style="font-size:1.1rem">${Utils.sanitizeHTML(node.icon || '📌')}</span>
          <span class="tree-node-label" data-node-id="${id}">${Utils.sanitizeHTML(node.label)}</span>
          ${node.custom ? '<span class="badge badge-sky" style="margin-left:auto;font-size:0.65rem">Custom</span>' : ''}
          ${hasChildren ? `<span class="badge badge-outline tree-node-badge">${node.children.length}</span>` : ''}
          ${addChildBtn}
          ${this.isAdmin ? `<button class="btn btn-ghost btn-sm" style="color:var(--coral);margin-left:8px;padding:0 4px" data-delete-id="${id}" title="Eliminar nodo">🗑️</button>` : ''}
        </div>
        ${hasChildren ? `
          <div class="tree-node-children" id="children-${id}">
            ${node.children.map(child => this.renderNode(child, level + 1)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  toggleNode(nodeId) {
    document.querySelectorAll('.tree-node-header.node-selected')
      .forEach(el => el.classList.remove('node-selected'));
    this.selectedNodeId = nodeId;

    const header = document.querySelector(`#node-${nodeId} > .tree-node-header`);
    const children = document.getElementById(`children-${nodeId}`);
    if (!children) return;
    const isOpen = children.classList.toggle('open');
    header?.classList.toggle('open', isOpen);
    if (header) header.classList.add('node-selected');
  },
  showNodeContent(nodeId) {
    window.location.href = `${location.origin}/nodo.html#id=${encodeURIComponent(nodeId)}`;
  },

  expandAll() {
    document.querySelectorAll('.tree-node-children').forEach(el => el.classList.add('open'));
    document.querySelectorAll('.tree-node-header').forEach(el => el.classList.add('open'));
  },

  collapseAll() {
    document.querySelectorAll('.tree-node-children').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.tree-node-header').forEach(el => el.classList.remove('open'));
  },

  _findParentId(nodeId) {
    const tree = TreeManager.getTree();
    const find = (nodes, parentId) => {
      for (const n of nodes) {
        if (String(n.id) === String(nodeId)) return parentId;
        if (n.children) {
          const r = find(n.children, n.id);
          if (r !== undefined) return r;
        }
      }
      return undefined;
    };
    return find(tree, null);
  },

  showNodeTypeSelector() {
    const dropdown = document.getElementById('node-type-selector');
    if (!dropdown) return;

    if (dropdown.style.display === 'block') {
      dropdown.style.display = 'none';
      dropdown.classList.remove('visible');
      return;
    }

    const trigger = document.getElementById('add-node-card');
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const dropH = 152;
      const dropW = 240;
      const spaceAbove = rect.top;
      var topPos = spaceAbove >= dropH + 16 ? rect.top - dropH - 8 : rect.bottom + 8;
      var leftPos = Math.min(rect.left, window.innerWidth - dropW - 8);
      dropdown.style.position = 'fixed';
      dropdown.style.top = Math.max(8, topPos) + 'px';
      dropdown.style.left = Math.max(8, leftPos) + 'px';
      dropdown.style.right = 'auto';
      dropdown.style.bottom = 'auto';
    }

    dropdown.style.display = 'block';
    dropdown.classList.add('visible');

    var dropdown2 = dropdown;

    function closeDropdown(e) {
      var card = document.getElementById('add-node-card');
      if (!dropdown2.contains(e.target) && (!card || !card.contains(e.target))) {
        dropdown2.style.display = 'none';
        dropdown2.classList.remove('visible');
        document.removeEventListener('click', closeDropdown, true);
        document.removeEventListener('keydown', onEsc);
      }
    }

    function onEsc(e) {
      if (e.key === 'Escape') {
        dropdown2.style.display = 'none';
        dropdown2.classList.remove('visible');
        document.removeEventListener('click', closeDropdown, true);
        document.removeEventListener('keydown', onEsc);
      }
    }

    setTimeout(function () {
      document.addEventListener('click', closeDropdown, true);
      document.addEventListener('keydown', onEsc);
    }, 0);
  },

  handleNodeTypeChoice(type) {
    const dropdown = document.getElementById('node-type-selector');
    if (dropdown) { dropdown.classList.remove('visible'); dropdown.style.display = 'none'; }

    if (type === 'hijo') {
      if (this.selectedNodeId) {
        this.openAddModal(this.selectedNodeId, 'hijo');
      } else {
        const tree = TreeManager.getTree();
        this.openAddModal(tree.length > 0 ? tree[0].id : null, 'hijo');
      }
    } else {
      if (this.selectedNodeId) {
        const parentId = this._findParentId(this.selectedNodeId);
        const grandparentId = parentId ? this._findParentId(parentId) : null;
        this.openAddModal(grandparentId, 'padre');
      } else {
        this.openAddModal(null, 'padre');
      }
    }
  },

  openAddModal(parentId, tipo = 'hijo') {
    document.getElementById('new-node-parent').value = (parentId !== null && parentId !== undefined) ? parentId : '';
    document.getElementById('new-node-label').value = '';

    const categoryGroup = document.getElementById('parent-category-group');
    const categoryLabel = document.getElementById('parent-category-label');
    const modalTitle = document.querySelector('#add-node-modal .modal-header h3');

    if (tipo === 'padre') {
      if (modalTitle) modalTitle.textContent = '🌳 Nuevo nodo padre';
      if (categoryGroup) categoryGroup.style.display = 'none';
    } else {
      if (modalTitle) modalTitle.textContent = '➕ Agregar nodo';
      if (categoryGroup) categoryGroup.style.display = '';
      if (categoryLabel) categoryLabel.textContent = 'Categoría principal';

      const tree = TreeManager.getTree();
      const selector = document.getElementById('parent-category-selector');
      if (selector) {
        const activeId = (parentId !== null && parentId !== undefined) ? String(parentId) : '';
        selector.innerHTML = tree.map(function (node, i) {
          var isSelected = (activeId && activeId === String(node.id)) || (!activeId && i === 0);
          return '<button type="button" class="icon-btn ' + (isSelected ? 'selected' : '') + '" title="' + node.label + '"' +
            ' onclick="document.getElementById(\'new-node-parent\').value=\'' + node.id + '\';' +
            'document.querySelectorAll(\'#parent-category-selector .icon-btn\').forEach(function(b){b.classList.remove(\'selected\')});' +
            'this.classList.add(\'selected\')">' +
            (node.icon || '📌') +
            '</button>';
        }).join('');
        if (!activeId && tree.length > 0) {
          document.getElementById('new-node-parent').value = tree[0].id;
        }
      }
    }

    const contentEl = document.getElementById('new-node-content');
    if (contentEl) contentEl.value = '';

    UI.openModal('add-node-modal');
    setTimeout(() => document.getElementById('new-node-label')?.focus(), 300);
  },

  async addNewNode() {
    const parentId = document.getElementById('new-node-parent').value;
    const label = document.getElementById('new-node-label').value.trim();
    const contentEl = document.getElementById('new-node-content');
    const content = contentEl ? contentEl.value.trim() : '';

    if (!label) { UI.showToast('Escribe un nombre para el nodo.', 'error'); return; }

    const btn = document.getElementById('save-node-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
      await NodosAPI.crearNodo({ id_padre: parentId, nombre: label, icono: '📌', contenido: content });
      UI.showToast(`Nodo "${label}" guardado en la base de datos exitosamente.`, 'success');
      UI.closeModal('add-node-modal');
      await this.loadTree();
    } catch (error) {
      console.error('Error al crear el nodo:', error);
      UI.showToast(error.mensaje || 'Error al guardar el nodo.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Agregar ✓'; }
    }
  },

  async deleteNodeById(nodeId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este nodo y todo su contenido?')) return;

    try {
      if (!isNaN(parseInt(nodeId)) && !String(nodeId).match(/^[a-zA-Z]/)) {
        await NodosAPI.eliminarNodo(nodeId);
      } else {
        TreeManager.deleteNode(nodeId);
      }
      UI.showToast('Nodo eliminado correctamente.', 'success');
      await this.loadTree();
      this.renderTree();
    } catch (err) {
      console.error('Error al eliminar nodo:', err);
      UI.showToast(err.mensaje || 'Error al eliminar el nodo.', 'error');
    }
  },

  startInlineEdit(nodeId) {
    if (!this.isAdmin) return;

    const nodeEl = document.getElementById(`node-${nodeId}`);
    if (!nodeEl) return;
    const labelSpan = nodeEl.querySelector(`:scope > .tree-node-header .tree-node-label[data-node-id="${nodeId}"]`);
    if (!labelSpan) return;
    if (labelSpan.querySelector('.tree-inline-input')) return;

    const originalText = labelSpan.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-inline-input';
    input.value = originalText;
    input.setAttribute('data-original', originalText);

    labelSpan.textContent = '';
    labelSpan.appendChild(input);
    input.focus();
    input.select();

    let saved = false;

    const save = async () => {
      if (saved) return;
      saved = true;
      const newName = input.value.trim();
      if (labelSpan.contains(input)) labelSpan.removeChild(input);
      if (!newName || newName === originalText) { labelSpan.textContent = originalText; return; }
      labelSpan.textContent = newName;

      if (!isNaN(parseInt(nodeId)) && !String(nodeId).match(/^[a-zA-Z]/)) {
        try {
          await NodosAPI.actualizarNombre(nodeId, newName);
          UI.showToast(`Nodo renombrado a "${newName}"`, 'success');
        } catch (err) {
          console.error('Error al renombrar nodo:', err);
          labelSpan.textContent = originalText;
          UI.showToast(err.mensaje || 'Error al renombrar el nodo.', 'error');
        }
      } else {
        const node = TreeManager.getNodeById(nodeId);
        if (node) { node.label = newName; TreeManager.saveTree(TreeManager.getTree()); }
        UI.showToast(`Nodo renombrado a "${newName}"`, 'success');
      }
    };

    const cancel = () => {
      if (saved) return;
      saved = true;
      if (labelSpan.contains(input)) labelSpan.removeChild(input);
      labelSpan.textContent = originalText;
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', () => setTimeout(() => save(), 80));
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
  },

  async addChildInline(parentId) {
    if (!this.isAdmin) return;

    let childrenContainer = document.getElementById(`children-${parentId}`);
    const parentNodeEl = document.getElementById(`node-${parentId}`);
    if (!parentNodeEl) return;

    if (!childrenContainer) {
      childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-node-children open';
      childrenContainer.id = `children-${parentId}`;
      parentNodeEl.appendChild(childrenContainer);
    }

    childrenContainer.classList.add('open');
    const header = parentNodeEl.querySelector(':scope > .tree-node-header');
    if (header) header.classList.add('open');

    const tempId = 'temp_' + Date.now();
    const tempDiv = document.createElement('div');
    tempDiv.className = 'tree-node tree-leaf temp-node';
    tempDiv.id = `node-${tempId}`;
    tempDiv.setAttribute('data-node-id', tempId);

    const parentLevel = parseInt((parentNodeEl.className.match(/level-(\d)/) || [0, 0])[1]);
    tempDiv.classList.add(`level-${Math.min(parentLevel + 1, 3)}`);

    tempDiv.innerHTML = `
      <div class="tree-node-header">
        <div style="width:22px"></div>
        <span style="font-size:1.1rem">📌</span>
        <span class="tree-node-label" data-node-id="${tempId}">Nuevo tema</span>
      </div>
    `;

    childrenContainer.appendChild(tempDiv);
    tempDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const labelSpan = tempDiv.querySelector('.tree-node-label');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-inline-input';
    input.value = 'Nuevo tema';
    input.setAttribute('data-original', '');

    labelSpan.textContent = '';
    labelSpan.appendChild(input);
    input.focus();
    input.select();

    let resolved = false;

    const confirmCreate = async () => {
      if (resolved) return;
      resolved = true;
      const newName = input.value.trim();
      if (!newName) { tempDiv.remove(); return; }
      if (labelSpan.contains(input)) labelSpan.removeChild(input);
      labelSpan.textContent = newName;

      try {
        const res = await NodosAPI.crearNodo({ id_padre: parentId, nombre: newName, icono: '📌' });
        const serverId = res.datos?.id;
        if (serverId) {
          tempDiv.id = `node-${serverId}`;
          tempDiv.setAttribute('data-node-id', serverId);
          labelSpan.setAttribute('data-node-id', serverId);
          const headerEl = tempDiv.querySelector('.tree-node-header');
          if (headerEl) headerEl.setAttribute('data-navigate-id', String(serverId));
        }
        UI.showToast(`Nodo "${newName}" creado exitosamente.`, 'success');
        const parentBadge = parentNodeEl.querySelector(':scope > .tree-node-header .tree-node-badge');
        if (parentBadge) parentBadge.textContent = (parseInt(parentBadge.textContent) || 0) + 1;
        setTimeout(() => this.loadTree(), 500);
      } catch (err) {
        console.error('Error al crear nodo hijo:', err);
        UI.showToast(err.mensaje || 'Error al crear el nodo.', 'error');
        tempDiv.remove();
      }
    };

    const cancelCreate = () => {
      if (resolved) return;
      resolved = true;
      tempDiv.remove();
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); confirmCreate(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelCreate(); }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!resolved) {
          if (!input.value.trim()) cancelCreate();
          else confirmCreate();
        }
      }, 80);
    });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
  },

  setupInlineEditListeners() {
    const container = document.getElementById('tree-container');
    if (!container || container._treeBound) return;
    container._treeBound = true;

    container.addEventListener('click', (e) => {
      // Toggle expand/collapse
      const toggle = e.target.closest('[data-toggle-id]');
      if (toggle) {
        e.stopPropagation();
        this.toggleNode(toggle.getAttribute('data-toggle-id'));
        return;
      }

      // Add child (admin only)
      const addBtn = e.target.closest('[data-add-child]');
      if (addBtn && this.isAdmin) {
        e.stopPropagation();
        this.addChildInline(addBtn.getAttribute('data-add-child'));
        return;
      }

      // Delete node (admin only)
      const delBtn = e.target.closest('[data-delete-id]');
      if (delBtn && this.isAdmin) {
        e.stopPropagation();
        this.deleteNodeById(delBtn.getAttribute('data-delete-id'));
        return;
      }

      // Navigate to node content
      const header = e.target.closest('[data-navigate-id]');
      if (header) {
        const nodeId = header.getAttribute('data-navigate-id');
        if (nodeId) this.showNodeContent(nodeId);
      }
    });

    if (this.isAdmin) {
      container.addEventListener('dblclick', (e) => {
        const label = e.target.closest('.tree-node-label');
        if (!label) return;
        e.preventDefault();
        e.stopPropagation();
        const nodeId = label.getAttribute('data-node-id');
        if (nodeId) this.startInlineEdit(nodeId);
      });
    }
  },
};
