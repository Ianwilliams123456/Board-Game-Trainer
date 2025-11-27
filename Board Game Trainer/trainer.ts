// trainer.ts - TypeScript-powered board game trainer prototype (ES6-compatible)

type ResourceType = "number" | "derived" | "escalator";
type ResourceScope = "global" | "perPlayer";

interface DerivedConfig {
  fn: "riskNextArmies";
  args: string[];
}

interface ResourceConfig {
  key: string;
  label: string;
  type: ResourceType;
  scope: ResourceScope;
  min?: number;
  max?: number;
  derive?: DerivedConfig;
  schedule?: number[];
  step?: number;
  counterKey?: string;
}

interface PlayerField {
  key: string;
  label: string;
  type: "text" | "color";
}

interface GameConfig {
  key: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  phases: string[];
  resources: ResourceConfig[];
  players: { fields: PlayerField[] };
}

interface PlayerState {
  id: number;
  name: string;
  color: string;
  resources: Record<string, number>;
}

interface GameState {
  turn: number;
  phaseIndex: number;
  activePlayer: number;
  globals: Record<string, number>;
  players: PlayerState[];
}

const GAME_CONFIGS: GameConfig[] = [
  {
    key: "risk",
    name: "Risk (Classic)",
    minPlayers: 2,
    maxPlayers: 6,
    phases: ["Reinforcement", "Attack", "Fortify"],
    resources: [
      { key: "setsTurnedIn", label: "Card Sets Turned In", type: "number", scope: "global", min: 0, max: 999 },
      { key: "riskTurnIn", label: "Next Card Turn-In (Armies)", type: "derived", scope: "global", derive: { fn: "riskNextArmies", args: ["setsTurnedIn"] } },
      { key: "riskCardEscalator", label: "Card Turn-Ins (Escalating)", type: "escalator", scope: "global", schedule: [4, 6, 8, 10, 12, 15], step: 5, counterKey: "setsTurnedIn" }
    ],
    players: { fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "color", label: "Color", type: "color" }
    ] }
  },
  {
    key: "risk-clonewars",
    name: "Risk: Star Wars - The Clone Wars",
    minPlayers: 2,
    maxPlayers: 5,
    phases: ["Reinforcement", "Attack", "Fortify"],
    resources: [
      { key: "setsTurnedIn", label: "Card Sets Turned In", type: "number", scope: "global", min: 0, max: 999 },
      { key: "riskTurnIn", label: "Next Card Turn-In (Armies)", type: "derived", scope: "global", derive: { fn: "riskNextArmies", args: ["setsTurnedIn"] } },
      { key: "riskCardEscalator", label: "Card Turn-Ins (Escalating)", type: "escalator", scope: "global", schedule: [4, 6, 8, 10, 12, 15], step: 5, counterKey: "setsTurnedIn" },
      { key: "systemsHeld", label: "Systems Held", type: "number", scope: "perPlayer", min: 0, max: 50 },
      { key: "reinforcementPool", label: "Reinforcement Pool", type: "number", scope: "perPlayer", min: 0, max: 50 }
    ],
    players: { fields: [
      { key: "name", label: "Faction / Commander", type: "text" },
      { key: "color", label: "Color", type: "color" }
    ] }
  },
  {
    key: "dune-war-for-arrakis",
    name: "Dune: War for Arrakis",
    minPlayers: 2,
    maxPlayers: 2,
    phases: ["Round Start", "Action Phase", "Refresh"],
    resources: [
      { key: "round", label: "Round", type: "number", scope: "global", min: 1, max: 12 },
      { key: "victoryPoints", label: "Victory Points", type: "number", scope: "perPlayer", min: 0, max: 15 },
      { key: "spice", label: "Spice Stockpile", type: "number", scope: "perPlayer", min: 0, max: 50 },
      { key: "supply", label: "Supply / Logistics", type: "number", scope: "perPlayer", min: 0, max: 20 },
      { key: "troopPool", label: "Troops in Reserve", type: "number", scope: "perPlayer", min: 0, max: 30 }
    ],
    players: { fields: [
      { key: "name", label: "Faction", type: "text" },
      { key: "color", label: "Color", type: "color" }
    ] }
  },
  {
    key: "arknova",
    name: "Ark Nova",
    minPlayers: 1,
    maxPlayers: 4,
    phases: ["Take Action", "Check Break", "Break: Income / Reset"],
    resources: [
      { key: "breakMeter", label: "Break Meter", type: "number", scope: "global", min: 0, max: 16 },
      { key: "money", label: "Money", type: "number", scope: "perPlayer", min: 0, max: 999 },
      { key: "xTokens", label: "X Tokens", type: "number", scope: "perPlayer", min: 0, max: 5 },
      { key: "appeal", label: "Appeal", type: "number", scope: "perPlayer", min: 0, max: 200 },
      { key: "conservation", label: "Conservation", type: "number", scope: "perPlayer", min: 0, max: 30 },
      { key: "reputation", label: "Reputation", type: "perPlayer", min: 0, max: 20 }
    ],
    players: { fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "color", label: "Color", type: "color" }
    ] }
  }
];

const PANEL_IDEAS: Record<string, string[]> = {
  risk: [
    "Territory + continent bonus tracker",
    "Mission / objective reminder and deck status",
    "Fog-of-war notes for hidden armies",
    "Trade-in schedule cheat sheet for quick planning"
  ],
  "risk-clonewars": [
    "Order 66 countdown / clones remaining",
    "Planet system control summary",
    "Droid factory production & capital ship tracker",
    "Event card log with last resolution time"
  ],
  "dune-war-for-arrakis": [
    "Storm position & spice blow reference",
    "Guild shipping / movement allowances per round",
    "Victory point milestones and tiebreak notes",
    "Stronghold control tracker by player"
  ],
  arknova: [
    "Income reminder for each break step",
    "Action card row tracker (1-5 strength)",
    "Sponsor / animal icon synergies quick view",
    "Association worker availability per player"
  ]
};

const DEFAULT_COLORS = ["#5BC0EB", "#F25F5C", "#FFE066", "#247BA0", "#70C1B3", "#C77DFF"];

const deriveFns: Record<string, (...args: number[]) => number> = {
  riskNextArmies: (setsTurnedIn: number) => {
    const schedule = [4, 6, 8, 10, 12, 15];
    if (setsTurnedIn <= 0) return schedule[0];
    if (setsTurnedIn <= schedule.length) return schedule[setsTurnedIn - 1];
    const over = setsTurnedIn - schedule.length;
    return schedule[schedule.length - 1] + over * 5;
  }
};

function computeEscalation(count: number, schedule: number[], step: number): { last: number | null; next: number } {
  const safeSchedule = schedule || [];
  const safeStep = typeof step === "number" ? step : 1;
  if (count <= 0) return { last: null, next: safeSchedule.length ? safeSchedule[0] : safeStep };
  let last: number;
  if (count <= safeSchedule.length) {
    last = safeSchedule[count - 1];
  } else {
    const over = count - safeSchedule.length;
    last = (safeSchedule[safeSchedule.length - 1] || 0) + over * safeStep;
  }
  let next: number;
  if (count < safeSchedule.length) {
    next = safeSchedule[count];
  } else {
    const overNext = count - safeSchedule.length + 1;
    next = (safeSchedule[safeSchedule.length - 1] || 0) + overNext * safeStep;
  }
  return { last, next };
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (typeof min === "number") result = Math.max(min, result);
  if (typeof max === "number") result = Math.min(max, result);
  return result;
}

function getNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function getMin(resource: ResourceConfig, fallback = 0): number {
  return typeof resource.min === "number" ? resource.min : fallback;
}

type ValueGetter = (player: PlayerState, res: ResourceConfig) => number;

function createFreshState(config: GameConfig, desiredPlayers: number): GameState {
  const count = clamp(desiredPlayers, config.minPlayers, config.maxPlayers);
  const globals: Record<string, number> = {};
  const firstLabel = config.players.fields.length ? config.players.fields[0].label : "Player";

  const players: PlayerState[] = Array.from({ length: count }, (_, idx) => ({
    id: idx,
    name: `${firstLabel} ${idx + 1}`,
    color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    resources: {}
  }));

  config.resources.forEach((resource) => {
    if (resource.scope === "global" && resource.type === "number") {
      globals[resource.key] = getMin(resource, 0);
    }
    if (resource.scope === "perPlayer" && resource.type === "number") {
      players.forEach((player) => {
        player.resources[resource.key] = getMin(resource, 0);
      });
    }
  });

  return {
    turn: 1,
    phaseIndex: 0,
    activePlayer: 0,
    globals,
    players
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const gameSelect = document.getElementById("game-select") as HTMLSelectElement | null;
  const playerCountInput = document.getElementById("player-count") as HTMLInputElement | null;
  const playerRange = document.getElementById("player-range") as HTMLElement | null;
  const restartBtn = document.getElementById("restart-btn") as HTMLButtonElement | null;

  const globalList = document.getElementById("global-list") as HTMLElement | null;
  const globalHint = document.getElementById("global-hint") as HTMLElement | null;
  const playersList = document.getElementById("players-list") as HTMLElement | null;
  const playersHint = document.getElementById("players-hint") as HTMLElement | null;
  const ideasList = document.getElementById("ideas-list") as HTMLElement | null;
  const playerButtons = document.getElementById("player-buttons") as HTMLElement | null;

  const phaseLabel = document.getElementById("phase-label") as HTMLElement | null;
  const turnNumber = document.getElementById("turn-number") as HTMLElement | null;
  const activePlayerEl = document.getElementById("active-player") as HTMLElement | null;
  const activePhase = document.getElementById("active-phase") as HTMLElement | null;
  const turnPanel = document.getElementById("turn-panel") as HTMLElement | null;

  if (!gameSelect || !playerCountInput || !playerRange || !globalList || !playersList || !ideasList || !turnPanel || !restartBtn || !globalHint || !playersHint || !phaseLabel || !turnNumber || !activePlayerEl || !activePhase || !playerButtons) {
    console.warn("Trainer: missing core elements");
    return;
  }

  gameSelect.innerHTML = "";
  GAME_CONFIGS.forEach((cfg) => {
    const opt = document.createElement("option");
    opt.value = cfg.key;
    opt.textContent = cfg.name;
    gameSelect.appendChild(opt);
  });

  let activeConfig = GAME_CONFIGS[0];
  let state = createFreshState(activeConfig, activeConfig.minPlayers);
  gameSelect.value = activeConfig.key;

  function renderSelectors() {
    playerCountInput.min = String(activeConfig.minPlayers);
    playerCountInput.max = String(activeConfig.maxPlayers);
    playerCountInput.value = String(state.players.length);
    playerRange.textContent = `${activeConfig.minPlayers}-${activeConfig.maxPlayers} players`;
  }

  function stepPlayer(delta: number) {
    const total = state.players.length;
    if (total === 0) return;
    state.activePlayer = (state.activePlayer + delta + total) % total;
    if (delta > 0 && state.activePlayer === 0) state.turn += 1;
    if (delta < 0 && state.activePlayer === total - 1) state.turn = Math.max(1, state.turn - 1);
  }

  function stepPhase(delta: number) {
    const len = activeConfig.phases.length;
    if (!len) return;
    state.phaseIndex = (state.phaseIndex + delta + len) % len;
  }

  function adjustTurn(delta: number) {
    const total = state.players.length;
    if (total) {
      state.activePlayer = (state.activePlayer + delta + total) % total;
    }
    state.turn = Math.max(1, state.turn + delta);
  }

  turnPanel.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.dataset.playerNav === "next") stepPlayer(1);
    if (target.dataset.playerNav === "prev") stepPlayer(-1);
    if (target.dataset.phase === "next") stepPhase(1);
    if (target.dataset.phase === "prev") stepPhase(-1);
    if (target.dataset.turn === "inc") adjustTurn(1);
    if (target.dataset.turn === "dec") adjustTurn(-1);
    renderAll();
  });

  restartBtn.addEventListener("click", () => {
    state = createFreshState(activeConfig, state.players.length);
    renderAll();
  });

  gameSelect.addEventListener("change", () => {
    const found = GAME_CONFIGS.find((cfg) => cfg.key === gameSelect.value);
    if (!found) return;
    activeConfig = found;
    const nextCount = clamp(state.players.length, activeConfig.minPlayers, activeConfig.maxPlayers);
    state = createFreshState(activeConfig, nextCount);
    renderAll();
  });

  playerCountInput.addEventListener("change", () => {
    const parsed = parseInt(playerCountInput.value || "0", 10);
    const nextCount = clamp(parsed, activeConfig.minPlayers, activeConfig.maxPlayers);
    state = createFreshState(activeConfig, nextCount);
    renderAll();
  });

  function renderTurnPanel() {
    phaseLabel.textContent = `${activeConfig.name} • ${state.players.length} players`;
    turnNumber.textContent = `Turn ${state.turn}`;
    const current = state.players[state.activePlayer];
    activePlayerEl.textContent = current ? current.name : "—";
    activePlayerEl.style.background = current ? `${current.color}33` : "transparent";
    activePlayerEl.style.borderRadius = "10px";
    activePlayerEl.style.padding = "4px 10px";
    activePhase.textContent = activeConfig.phases[state.phaseIndex] || "Free Play";
  }

  function renderGlobalResources() {
    globalList.innerHTML = "";
    const resources = activeConfig.resources.filter((r) => r.scope === "global");
    globalHint.textContent = resources.length ? "Tap + / - to adjust. Derived values update automatically." : "No global resources for this game.";

    resources.forEach((res) => {
      const row = document.createElement("div");
      row.className = "resource-row";

      const header = document.createElement("div");
      header.className = "resource-header";
      header.innerHTML = `<span>${res.label}</span><span class="resource-note">${res.type}</span>`;
      row.appendChild(header);

      const body = document.createElement("div");
      body.className = "resource-body";

      if (res.type === "number") {
        const fallback = getMin(res, 0);
        const value = getNumber(state.globals[res.key], fallback);
        const valuePill = document.createElement("div");
        valuePill.className = "value-pill";
        valuePill.textContent = String(value);

        const actions = document.createElement("div");
        actions.className = "resource-actions";
        const dec = document.createElement("button");
        dec.textContent = "-";
        dec.addEventListener("click", () => {
          const currentVal = getNumber(state.globals[res.key], fallback);
          state.globals[res.key] = clamp(currentVal - 1, res.min, res.max);
          renderAll();
        });
        const inc = document.createElement("button");
        inc.textContent = "+";
        inc.addEventListener("click", () => {
          const currentVal = getNumber(state.globals[res.key], fallback);
          state.globals[res.key] = clamp(currentVal + 1, res.min, res.max);
          renderAll();
        });
        actions.appendChild(dec);
        actions.appendChild(inc);
        body.appendChild(valuePill);
        body.appendChild(actions);
      }

      if (res.type === "derived") {
        const args = res.derive ? res.derive.args : [];
        const fn = res.derive ? deriveFns[res.derive.fn] : undefined;
        const argValues = args.map((key) => getNumber(state.globals[key], 0));
        const derivedValue = fn ? fn.apply(null, argValues) : 0;
        const valuePill = document.createElement("div");
        valuePill.className = "value-pill";
        valuePill.textContent = String(derivedValue);
        const note = document.createElement("div");
        note.className = "resource-note";
        note.textContent = `Based on ${args.length ? args.join(", ") : "state"}`;
        body.appendChild(valuePill);
        body.appendChild(note);
      }

      if (res.type === "escalator") {
        const counterKey = res.counterKey || "";
        const counter = getNumber(state.globals[counterKey], 0);
        const stepVal = typeof res.step === "number" ? res.step : 1;
        const { last, next } = computeEscalation(counter, res.schedule || [], stepVal);
        const valuePill = document.createElement("div");
        valuePill.className = "value-pill";
        valuePill.textContent = `${last === null ? "—" : last} ? ${next}`;
        const note = document.createElement("div");
        note.className = "resource-note";
        note.textContent = `Counter: ${counterKey || "n/a"}`;
        body.appendChild(valuePill);
        body.appendChild(note);
      }

      row.appendChild(body);
      globalList.appendChild(row);
    });
  }

  function renderPlayerCard(player: PlayerState, index: number): HTMLElement {
    const card = document.createElement("div");
    card.className = "player-card";

    const header = document.createElement("header");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = player.name;
    nameInput.addEventListener("input", () => {
      player.name = nameInput.value;
      renderTurnPanel();
      renderPlayerButtons();
    });

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = player.color;
    colorInput.addEventListener("input", () => {
      player.color = colorInput.value;
      renderPlayers();
      renderTurnPanel();
      renderPlayerButtons();
    });

    header.appendChild(nameInput);
    header.appendChild(colorInput);
    card.appendChild(header);

    const resourcesWrap = document.createElement("div");
    resourcesWrap.className = "player-resources";

    const perPlayerResources = activeConfig.resources.filter((r) => r.scope === "perPlayer");
    perPlayerResources.forEach((res) => {
      if (res.type !== "number") return;
      const row = document.createElement("div");
      row.className = "resource-row";

      const headerRow = document.createElement("div");
      headerRow.className = "resource-header";
      headerRow.innerHTML = `<span>${res.label}</span><span class="resource-note">${res.type}</span>`;
      row.appendChild(headerRow);

      const body = document.createElement("div");
      body.className = "resource-body";
      const fallback = getMin(res, 0);
      const value = getNumber(player.resources[res.key], fallback);
      const pill = document.createElement("div");
      pill.className = "value-pill";
      pill.textContent = String(value);

      const actions = document.createElement("div");
      actions.className = "resource-actions";
      const dec = document.createElement("button");
      dec.textContent = "-";
      dec.addEventListener("click", () => {
        const currentVal = getNumber(player.resources[res.key], fallback);
        player.resources[res.key] = clamp(currentVal - 1, res.min, res.max);
        renderPlayers();
        renderPlayerButtons();
      });
      const inc = document.createElement("button");
      inc.textContent = "+";
      inc.addEventListener("click", () => {
        const currentVal = getNumber(player.resources[res.key], fallback);
        player.resources[res.key] = clamp(currentVal + 1, res.min, res.max);
        renderPlayers();
        renderPlayerButtons();
      });
      actions.appendChild(dec);
      actions.appendChild(inc);
      body.appendChild(pill);
      body.appendChild(actions);
      row.appendChild(body);
      resourcesWrap.appendChild(row);
    });

    card.appendChild(resourcesWrap);
    return card;
  }

  function renderPlayers() {
    playersList.innerHTML = "";
    playersHint.textContent = `${state.players.length} active player${state.players.length === 1 ? "" : "s"}`;
    const active = state.players[state.activePlayer];
    if (!active) return;
    playersList.appendChild(renderPlayerCard(active, state.activePlayer));
  }

  function renderPlayerButtons() {
    playerButtons.innerHTML = "";
    const perPlayerResources = activeConfig.resources.filter((r) => r.scope === "perPlayer" && r.type === "number");
    state.players.forEach((player, idx) => {
      const btn = document.createElement("button");
      btn.className = "player-chip";
      if (idx === state.activePlayer) btn.classList.add("active");
      btn.textContent = player.name || `Player ${idx + 1}`;
      btn.style.background = idx === state.activePlayer ? undefined : `${player.color}22`;
      btn.style.borderColor = `${player.color}55`;
      const tooltip = perPlayerResources
        .map((res) => `${res.label}: ${getNumber(player.resources[res.key], getMin(res, 0))}`)
        .join("\n");
      btn.title = tooltip || "No per-player resources";
      btn.addEventListener("click", () => {
        state.activePlayer = idx;
        renderAll();
      });
      playerButtons.appendChild(btn);
    });
  }

  function renderIdeas() {
    ideasList.innerHTML = "";
    const ideas = PANEL_IDEAS[activeConfig.key] || [];
    ideas.forEach((idea) => {
      const li = document.createElement("li");
      li.textContent = idea;
      ideasList.appendChild(li);
    });
    if (!ideas.length) {
      const li = document.createElement("li");
      li.textContent = "Add your own panel ideas for this game.";
      ideasList.appendChild(li);
    }
  }

  function renderAll() {
    renderSelectors();
    renderTurnPanel();
    renderGlobalResources();
    renderPlayers();
    renderPlayerButtons();
    renderIdeas();
  }

  renderAll();
});

