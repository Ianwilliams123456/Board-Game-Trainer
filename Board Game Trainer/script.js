document.addEventListener("DOMContentLoaded", () => {
    const players = JSON.parse(localStorage.getItem("riskPlayers")) || [];

    let currentPlayer = 0;
    let turnInCount = 0;

    const turnBox = document.getElementById("turn-tracker-box");
    const cardList = document.getElementById("card-turnin-log");
    const mainGrid = document.getElementById("main-grid");

    // ----------------------------
    // Risk Card Turn-In (existing)
    // ----------------------------
    function getReinforcementValue(n) {
        if (n === 0) return "None";
        if (n === 1) return 4;
        if (n === 2) return 6;
        if (n === 3) return 8;
        if (n === 4) return 10;
        if (n === 5) return 12;
        if (n === 6) return 15;
        return 15 + (n - 6) * 5;
    }

    function updateTurnDisplay() {
        const player = players[currentPlayer] || { name: "Player 1", color: "#888", text: "black" };
        turnBox.style.backgroundColor = player.color;
        turnBox.style.color = player.text || "black";
        turnBox.innerText = player.name;
    }

    function updateCardDisplay() {
        const last = getReinforcementValue(turnInCount);
        const next = getReinforcementValue(turnInCount + 1);
        cardList.innerHTML = `
      <li><strong>Turn-Ins:</strong> ${turnInCount}</li>
      <li><strong>Last Turn-In:</strong> ${last} armies</li>
      <li><strong>Next Turn-In:</strong> ${next} armies</li>
    `;
    }

    document.addEventListener("keydown", (e) => {
        if (mainGrid && mainGrid.style.display !== "none") {
            if (e.code === "Space") {
                currentPlayer = (currentPlayer + 1) % Math.max(players.length, 1);
                updateTurnDisplay();
                e.preventDefault();
            } else if (e.code === "ArrowRight") {
                turnInCount++;
                updateCardDisplay();
            } else if (e.code === "ArrowLeft") {
                if (turnInCount > 0) turnInCount--;
                updateCardDisplay();
            }
        }
    });

    updateTurnDisplay();
    updateCardDisplay();

    // -----------------------------------------
    // Generic "Escalating Trackers" (NEW)
    // -----------------------------------------
    // Each tracker has: id, name, count, schedule (array), step (number)
    // Example schedule: [4,6,8,10,12,15], step: 5  -> after schedule ends, +5 each
    const ESC_KEY = "riskEscalators";

    const escForm = document.getElementById("esc-form");
    const escNameEl = document.getElementById("esc-name");
    const escScheduleEl = document.getElementById("esc-schedule");
    const escStepEl = document.getElementById("esc-step");
    const escResetBtn = document.getElementById("esc-reset");
    const escList = document.getElementById("escalator-list");

    let escalators = loadEscalators();

    function loadEscalators() {
        try {
            const raw = localStorage.getItem(ESC_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveEscalators() {
        localStorage.setItem(ESC_KEY, JSON.stringify(escalators));
    }

    function parseScheduleInput(value) {
        // "4,6,8,10,12,15" -> [4,6,8,10,12,15]
        return value
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
            .map(Number)
            .filter(n => Number.isFinite(n) && n > 0);
    }

    // Given a count (how many turn-ins have occurred), compute {last, next}
    function computeEscalation(count, schedule, step) {
        if (count <= 0) {
            return { last: null, next: schedule[0] ?? step };
        }
        // last value
        let last;
        if (count <= schedule.length) {
            last = schedule[count - 1];
        } else {
            const over = count - schedule.length; // 1..N beyond schedule
            last = (schedule[schedule.length - 1] ?? 0) + over * step;
        }
        // next value
        let next;
        if (count < schedule.length) {
            next = schedule[count];
        } else {
            const overNext = count - schedule.length + 1; // next slot after current
            next = (schedule[schedule.length - 1] ?? 0) + overNext * step;
        }
        return { last, next };
    }

    function renderEscalators() {
        escList.innerHTML = "";
        if (!escalators.length) return;

        escalators.forEach(tr => {
            const { last, next } = computeEscalation(tr.count, tr.schedule, tr.step);

            const li = document.createElement("li");
            li.className = "escalator-row";
            li.dataset.id = tr.id;

            li.innerHTML = `
        <div class="name">${tr.name}</div>
        <div class="pill">Turn-Ins: ${tr.count}</div>
        <div class="pill">Last: ${last ?? "None"}</div>
        <div class="pill">Next: ${next}</div>
        <div class="escalator-actions">
          <button type="button" data-act="dec">−</button>
          <button type="button" data-act="inc">+</button>
          <button type="button" data-act="del" title="Remove tracker">🗑</button>
        </div>
      `;

            li.addEventListener("click", (e) => {
                const btn = e.target.closest("button");
                if (!btn) return;
                const act = btn.dataset.act;
                if (act === "inc") {
                    tr.count++;
                } else if (act === "dec") {
                    tr.count = Math.max(0, tr.count - 1);
                } else if (act === "del") {
                    escalators = escalators.filter(x => x.id !== tr.id);
                }
                saveEscalators();
                renderEscalators();
            });

            escList.appendChild(li);
        });
    }

    // Add new tracker
    if (escForm) {
        escForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = (escNameEl.value || "").trim() || "Tracker";
            const schedule = parseScheduleInput(escScheduleEl.value);
            const step = Math.max(1, parseInt(escStepEl.value || "5", 10));

            const newTracker = {
                id: String(Date.now()) + Math.random().toString(16).slice(2),
                name,
                count: 0,
                schedule,
                step
            };
            escalators.push(newTracker);
            saveEscalators();
            renderEscalators();

            escNameEl.value = "";
        });
    }

    // Reset all
    if (escResetBtn) {
        escResetBtn.addEventListener("click", () => {
            if (confirm("Remove all custom trackers?")) {
                escalators = [];
                saveEscalators();
                renderEscalators();
            }
        });
    }

    renderEscalators();
});

