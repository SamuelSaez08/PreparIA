/* ============================================================
   PreparIA — state.js
   Capa de estado: State, Auth, Streak, Simulacros, TreeManager
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   1. STATE MANAGER
────────────────────────────────────────────────────────── */
const State = (() => {
  const KEYS = {
    USER: 'preparia_user',
    SESSION: 'preparia_session',
    STREAK: 'preparia_streak',
    SIMULACROS: 'preparia_simulacros',
    PROGRESS: 'preparia_progress',
    TREE_NODES: 'preparia_tree_nodes',
    SETTINGS: 'preparia_settings',
  };

  const get = (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  };

  const set = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  };

  const remove = (key) => localStorage.removeItem(key);

  const clear = () => Object.values(KEYS).forEach(k => localStorage.removeItem(k));

  return { KEYS, get, set, remove, clear };
})();

/* ──────────────────────────────────────────────────────────
   2. AUTH MANAGER
────────────────────────────────────────────────────────── */
const Auth = (() => {
  const isLoggedIn = () => Session.isLoggedIn();

  const getUser = () => Session.getUser();

  const logout = async () => {
    await AuthAPI.logout();
  };

  const requireAuth = () => {
    if (!isLoggedIn()) window.location.href = 'login.html';
  };

  return { isLoggedIn, getUser, logout, requireAuth };
})();

/* ──────────────────────────────────────────────────────────
   3. STREAK MANAGER
────────────────────────────────────────────────────────── */
const Streak = (() => {
  const todayStr = () => new Date().toISOString().split('T')[0];

  const init = () => {
    State.set(State.KEYS.STREAK, {
      count: 1,
      lastDate: todayStr(),
      history: [todayStr()],
      longest: 1,
    });
  };

  const checkAndUpdate = () => {
    let s = State.get(State.KEYS.STREAK);
    if (!s) { init(); return; }

    const today = todayStr();
    if (s.lastDate === today) return;

    const last = new Date(s.lastDate);
    const now = new Date(today);
    const diff = Math.round((now - last) / (1000 * 60 * 60 * 24));

    s.count = diff === 1 ? s.count + 1 : 1;
    s.lastDate = today;
    s.history = [...(s.history || []).slice(-29), today];
    s.longest = Math.max(s.longest || 0, s.count);
    State.set(State.KEYS.STREAK, s);
  };

  const get = () => {
    const s = State.get(State.KEYS.STREAK);
    return s || { count: 0, history: [], longest: 0 };
  };

  const getWeek = () => {
    const s = get();
    const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const str = d.toISOString().split('T')[0];
      return {
        label: days[d.getDay() === 0 ? 6 : d.getDay() - 1],
        done: (s.history || []).includes(str),
        today: str === todayStr(),
      };
    });
  };

  const updateFromBackend = (backendData) => {
    if (!backendData) return;
    const current = get();
    const updated = {
      count: backendData.racha_actual || backendData.dias || current.count || 0,
      lastDate: todayStr(),
      history: backendData.actividad_semanal || backendData.historial || current.history || [],
      longest: backendData.racha_maxima || backendData.mejor_racha || current.longest || 0,
    };
    State.set(State.KEYS.STREAK, updated);
  };

  return { init, checkAndUpdate, get, getWeek, updateFromBackend };
})();

/* ──────────────────────────────────────────────────────────
   4. SIMULACROS MANAGER
────────────────────────────────────────────────────────── */
const Simulacros = (() => {
  const getHistory = () => State.get(State.KEYS.SIMULACROS) || [];

  const saveResult = (result) => {
    const history = getHistory();
    history.unshift({
      id: Date.now(),
      date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
      score: result.score,
      total: result.total,
      pct: Math.round((result.score / result.total) * 100),
      timeUsed: result.timeUsed,
      tema: 'Ciencias Sociales',
    });
    State.set(State.KEYS.SIMULACROS, history.slice(0, 20));
  };

  const getStats = () => {
    const history = getHistory();
    if (!history.length) return { avg: 0, best: 0, total: 0, lastPct: 0 };
    const pcts = history.map(h => h.pct);
    return {
      avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
      best: Math.max(...pcts),
      total: history.length,
      lastPct: pcts[0] || 0,
    };
  };

  const updateFromBackend = (backendHistory) => {
    if (!backendHistory || !backendHistory.length) return;
    const mapped = backendHistory.map(h => ({
      id: h.id || h.id_intento,
      date: h.fecha ? new Date(h.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
      score: h.correctas || h.puntaje || 0,
      total: h.total_preguntas || h.total || 10,
      pct: h.porcentaje || h.puntaje || Math.round(((h.correctas || 0) / (h.total_preguntas || 10)) * 100),
      timeUsed: h.tiempo_usado || 0,
      tema: h.materia || h.nombre_simulacro || 'Ciencias Sociales',
    }));
    State.set(State.KEYS.SIMULACROS, mapped.slice(0, 20));
  };

  return { getHistory, saveResult, getStats, updateFromBackend };
})();

/* ──────────────────────────────────────────────────────────
   5. TREE MANAGER
────────────────────────────────────────────────────────── */
const TreeManager = (() => {
  const DEFAULT_TREE = [];

  const transformBackendNode = (node) => {
    const rawIcon = node.icono || node.icon || '';
    const icon = rawIcon && rawIcon.length <= 4 ? rawIcon : '📌';
    return {
      id: node.id || node.id_nodo,
      label: node.nombre || node.label || 'Sin nombre',
      icon,
      description: node.descripcion || '',
      children: (node.hijos || node.children || []).map(transformBackendNode),
    };
  };

  const getTree = () => State.get(State.KEYS.TREE_NODES) || DEFAULT_TREE;

  const saveTree = (tree) => State.set(State.KEYS.TREE_NODES, tree);

  const setTreeFromBackend = (backendTree) => {
    const transformed = (backendTree || []).map(transformBackendNode);
    const merged = JSON.parse(JSON.stringify(DEFAULT_TREE));

    const findInTree = (nodes, id) => {
      for (const n of nodes) {
        if (String(n.id) === String(id)) return n;
        if (n.children) {
          const found = findInTree(n.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    for (const bNode of transformed) {
      const existing = findInTree(merged, bNode.id);
      if (existing) {
        existing.label = bNode.label || existing.label;
        existing.description = bNode.description || existing.description;
        if (bNode.icon && bNode.icon !== '📌') existing.icon = bNode.icon;
        if (bNode.children && bNode.children.length) {
          for (const child of bNode.children) {
            const existingChild = findInTree(existing.children || [], child.id);
            if (!existingChild) {
              existing.children = existing.children || [];
              existing.children.push(child);
            }
          }
        }
      } else {
        merged.push(bNode);
      }
    }

    saveTree(merged);
    return merged;
  };

  const addNode = (parentId, label, icon = '📌', description = '') => {
    const tree = getTree();
    const newNode = {
      id: 'node_' + Date.now(),
      label,
      icon,
      description,
      children: [],
      custom: true,
    };

    const insert = (nodes) => {
      for (const n of nodes) {
        if (String(n.id) === String(parentId)) {
          n.children = n.children || [];
          n.children.push(newNode);
          return true;
        }
        if (n.children && insert(n.children)) return true;
      }
      return false;
    };

    insert(tree);
    saveTree(tree);
    return newNode;
  };

  const deleteNode = (nodeId) => {
    const tree = getTree();

    const remove = (nodes) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === nodeId) { nodes.splice(i, 1); return true; }
        if (nodes[i].children && remove(nodes[i].children)) return true;
      }
      return false;
    };

    remove(tree);
    saveTree(tree);
  };

  const getNodeById = (nodeId) => {
    const tree = getTree();
    const find = (nodes) => {
      for (const n of nodes) {
        if (String(n.id) === String(nodeId)) return n;
        if (n.children) {
          const found = find(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return find(tree);
  };

  return { getTree, saveTree, setTreeFromBackend, addNode, deleteNode, getNodeById, DEFAULT_TREE };
})();
