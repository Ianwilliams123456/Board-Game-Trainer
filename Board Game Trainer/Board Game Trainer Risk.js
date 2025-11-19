// app.js
import * as Mech from './mechanics.js';

// Registry of derive functions by name
const Derivers = {
  riskNextArmies: Mech.riskNextArmies
};

const GAME_STORAGE_PREFIX = 'bgt_state_';

async function loadGameDef(key) {
  const res = await fetch(`./games/${key}.json`);
  return res.json();
}

function loadState(gameKey) {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_PREFIX + gameKey);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveState(gameKey, state) {
  localStorage.setItem(GAME_STORAGE_PREFIX + gameKey, JSON.stringify(state));
}

function ensureDefaults(def, state, playerCount = 2) {
  state.global ||= {};
  // global defaults
  def.resources
    .filter(r => r.scope === 'global' && (r.type === 'number' || r.type === 'escalator'))
    .forEach(r => {
      if (typeof state.global[r.key] !== 'number') state.global[r.key] = 0;
    });

  // players
  state.players ||= Array.from({ length: playerCount }, () => ({}));
  const wanted = Math.max(def.minPlayers, Math.min(def.maxPlayers, playerCount));
  state.players.length = wanted;

  // per-player defaults
  def.resources
    .filter(r => r.scope === 'perPlayer' && r.type === 'number')
    .forEach(r => {
      state.players.forEach(p => {
        if (typeof p[r.key] !== 'number') p[r.key] = 0;
      });
    });

  // basic fields (name/color)
  def.players?.fields?.forEach(f => {
    state.players.forEach(p => {
      if (f.type === 'text' && typeof p[f.key] !== 'string') p[f.key] = '';
      if (f.type === 'color' && typeof p[f.key] !== 'string') p[f.key] = '#999999';
    });
  });

  return state;
}

function makeNumberControl(label, value, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  wrap.innerHTML = `
    <div class="label">${label}</div>
    <div class="controls">
      <button type="button" class="dec">−</button>
      <span class="val">${value}</span>
      <button type="button" class="inc">+</button>
    </div>`;
  const valEl = wrap.querySelector('.val');
  wrap.querySelector('.inc').onclick = () => { onChange(value + 1); };
  wrap.querySelector('.dec').onclick = () => { onChange(Math.max(0, value - 1)); };
  // update live
  return { el: wrap, set(v){ value=v; valEl.textContent = v; } };
}

function makeEscalatorView(cfg, count, onChange) {
  const { schedule = [], step = 0 } = cfg;
  const { last, next } = Mech.nextFromSchedule(count, schedule, step);
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <div class="label">${cfg.label}</div>
    <div class="pill">Turn-Ins: <b class="cnt">${count}</b></div>
    <div class="pill">Last: <b class="last">${last ?? 'None'}</b></div>
    <div class="pill">Next: <b class="next">${next}</b></div>
    <div class="controls"><button class="dec">−</button><button class="inc">+</button></div>
  `;
  const cnt = row.querySelector('.cnt');
  const lastEl = row.querySelector('.last');
  const nextEl = row.querySelector('.next');

  function refresh(newCount) {
    const res = Mech.nextFromSchedule(newCount, schedule, step);
    cnt.textContent = newCount;
    lastEl.textContent = res.last ?? 'None';
    nextEl.textContent = res.next;
  }

  row.querySelector('.inc').onclick = () => { onChange(count + 1); };
  row.querySelector('.dec').onclick = () => { onChange(Math.max(0, count - 1)); };

  return { el: row, set(n){ count=n; refresh(n); } };
}

function makeDerivedRow(label, value) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<div class="label">${label}</div><div class="pill"><b>${value}</b></div>`;
  return { el: row, set(v){ row.querySelector('b').textContent = v; } };
}

async function renderGame(gameKey, playerCount = 2) {
  const def = await loadGameDef(gameKey);
  let state = ensureDefaults(def, loadState(gameKey), playerCount);

  const rootGlobal = document.getElementById('global-panel');
  const rootPlayers = document.getElementById('players-panel');
  rootGlobal.innerHTML = ''; rootPlayers.innerHTML = '';

  // GLOBAL
  const widgets = [];

  def.resources.forEach(r => {
    if (r.scope !== 'global') return;

    if (r.type === 'number') {
      const w = makeNumberControl(r.label, state.global[r.key] ?? 0, (v) => {
        state.global[r.key] = v; saveState(gameKey, state);
        // recompute derived rows that depend on this key
        widgets.forEach(x => x.recalc && x.recalc());
        w.set(v);
      });
      widgets.push(w);
      rootGlobal.appendChild(w.el);
    }

    if (r.type === 'escalator') {
      // escalator reads/writes a counter (counterKey) in state.global
      const counterKey = r.counterKey;
      const w = makeEscalatorView(r, state.global[counterKey] ?? 0, (v) => {
        state.global[counterKey] = v; saveState(gameKey, state);
        widgets.forEach(x => x.recalc && x.recalc());
        w.set(v);
      });
      widgets.push(w);
      rootGlobal.appendChild(w.el);
    }

    if (r.type === 'derived') {
      // compute via deriver fn with args mapped from state
      const deriver = Derivers[r.derive.fn];
      const compute = () => {
        const args = (r.derive.args || []).map(k => state.global[k]);
        return deriver ? deriver(...args) : '';
      };
      const w = makeDerivedRow(r.label, compute());
      w.recalc = () => w.set(compute());
      widgets.push(w);
      rootGlobal.appendChild(w.el);
    }
  });

  // PLAYERS
  state.players.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="hdr"><input class="nm" value="${p.name || `Player ${idx+1}`}" />
      <input class="clr" type="color" value="${p.color || '#888888'}"></div>
      <div class="body"></div>
    `;
    const body = card.querySelector('.body');

    // per-player number resources
    def.resources.filter(r => r.scope === 'perPlayer' && r.type === 'number')
      .forEach(r => {
        const w = makeNumberControl(r.label, p[r.key] ?? 0, (v) => {
          p[r.key] = v; saveState(gameKey, state); w.set(v);
        });
        body.appendChild(w.el);
      });

    // basic fields watchers
    const nm = card.querySelector('.nm');
    const clr = card.querySelector('.clr');
    nm.oninput = () => { p.name = nm.value; saveState(gameKey, state); };
    clr.oninput = () => { p.color = clr.value; card.style.borderColor = p.color; saveState(gameKey, state); };

    card.style.border = `3px solid ${p.color || '#888'}`;
    rootPlayers.appendChild(card);
  });

  // initial recompute of any derived
  widgets.forEach(x => x.recalc && x.recalc());
}

// wiring: game switcher
const sel = document.getElementById('game-select');
sel.onchange = () => renderGame(sel.value, 2);
renderGame(sel.value || 'risk', 2);
