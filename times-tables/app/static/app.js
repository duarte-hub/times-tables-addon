/* ============================================================
   Times Tables Game — app.js
   ============================================================ */

const TOTAL_QUESTIONS = 10;
const REWARD_SCORE    = 8;   // min score to trigger HA reward
const REWARD_STREAK   = 5;   // min streak to trigger HA reward

/* -------- BOOT -------- */
window.addEventListener("DOMContentLoaded", async () => {

  /* --- DOM refs (inside DOMContentLoaded to guarantee elements exist) --- */
  const screens = {
    welcome: document.getElementById("screen-welcome"),
    game:    document.getElementById("screen-game"),
    results: document.getElementById("screen-results"),
  };

  /* --- Load config from server --- */
  let config = {
    player_name:    "Player",
    allowed_tables: [2,3,4,5,6,7,8,9,10],
    reward_automation: "",
  };
  try {
    const res = await fetch("/api/options");
    if (res.ok) config = await res.json();
  } catch (_) { /* dev / offline */ }

  /* --- Game state --- */
  const state = {
    selectedTables: [...config.allowed_tables].slice(0, 3), // default: first 3 allowed
    mixMode:  false,
    questions: [],
    currentQ:  0,
    score:     0,
    streak:    0,
    bestStreak:0,
    wrongCount:0,
    answering: false,
  };

  /* ---- Welcome screen setup ---- */
  const nameEl = document.getElementById("welcome-name");
  if (config.player_name && config.player_name !== "Player") {
    nameEl.textContent = `Hi ${config.player_name}! 👋 Let's practise!`;
  }

  buildTableButtons(config.allowed_tables, state);

  document.getElementById("mix-mode").addEventListener("change", (e) => {
    state.mixMode = e.target.checked;
  });

  document.getElementById("btn-start").addEventListener("click", () => {
    if (state.selectedTables.length === 0) return;
    showScreen(screens, "game");
    startRound(state, screens, config);
  });

  document.getElementById("btn-play-again").addEventListener("click", () => {
    showScreen(screens, "game");
    startRound(state, screens, config);
  });

  document.getElementById("btn-change-table").addEventListener("click", () => {
    showScreen(screens, "welcome");
  });

  showScreen(screens, "welcome");
});

/* ============================================================
   SCREEN NAV
   ============================================================ */
function showScreen(screens, name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

/* ============================================================
   TABLE SELECTOR
   ============================================================ */
function buildTableButtons(allowedTables, state) {
  const container = document.getElementById("table-buttons");
  container.innerHTML = "";

  allowedTables.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "tbl-btn" + (state.selectedTables.includes(t) ? " active" : "");
    btn.textContent = t;
    btn.dataset.t = t;
    btn.addEventListener("click", () => {
      const idx = state.selectedTables.indexOf(t);
      if (idx === -1) {
        state.selectedTables.push(t);
        btn.classList.add("active");
      } else {
        if (state.selectedTables.length === 1) return; // keep at least one
        state.selectedTables.splice(idx, 1);
        btn.classList.remove("active");
      }
    });
    container.appendChild(btn);
  });
}

/* ============================================================
   GAME ROUND
   ============================================================ */
function startRound(state, screens, config) {
  state.questions  = generateQuestions(state);
  state.currentQ   = 0;
  state.score      = 0;
  state.streak     = 0;
  state.bestStreak = 0;
  state.wrongCount = 0;
  updateHUD(state);
  nextQuestion(state, screens, config);
}

/* ============================================================
   QUESTION GENERATION
   ============================================================ */
function generateQuestions(state) {
  const tables = [...state.selectedTables];
  const qs = [];
  for (let i = 0; i < TOTAL_QUESTIONS; i++) {
    const table = state.mixMode
      ? tables[Math.floor(Math.random() * tables.length)]
      : tables[i % tables.length];
    const mult = randInt(1, 12);
    qs.push({ table, mult, answer: table * mult });
  }
  return shuffle(qs);
}

/* ============================================================
   SHOW QUESTION
   ============================================================ */
function nextQuestion(state, screens, config) {
  if (state.currentQ >= TOTAL_QUESTIONS) {
    showResults(state, screens, config);
    return;
  }

  const q = state.questions[state.currentQ];
  document.getElementById("question-text").textContent = `${q.table} × ${q.mult} = ?`;
  document.getElementById("feedback").textContent = "";
  document.getElementById("feedback").className = "feedback-msg";
  updateProgress(state);

  const choices = shuffle([q.answer, ...wrongAnswers(q.answer, 3)]);
  const grid = document.getElementById("choices");
  grid.innerHTML = "";

  choices.forEach(val => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = val;
    btn.addEventListener("click", () => handleAnswer(val, q.answer, btn, state, screens, config));
    grid.appendChild(btn);
  });

  state.answering = true;
}

/* ============================================================
   ANSWER HANDLING
   ============================================================ */
function handleAnswer(chosen, correct, btn, state, screens, config) {
  if (!state.answering) return;
  state.answering = false;
  document.querySelectorAll(".choice-btn").forEach(b => b.disabled = true);

  if (chosen === correct) {
    state.score++;
    state.streak++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    btn.classList.add("correct-ans");
    showFeedback("correct", pickPhrase());
    animateCard("pop");
    updateHUD(state);
    setTimeout(() => { state.currentQ++; nextQuestion(state, screens, config); }, 850);
  } else {
    state.streak = 0;
    state.wrongCount++;
    btn.classList.add("wrong-ans");
    document.querySelectorAll(".choice-btn").forEach(b => {
      if (Number(b.textContent) === correct) b.classList.add("correct-ans");
    });
    showFeedback("wrong", `${correct} was the answer`);
    animateCard("shake");
    updateHUD(state);
    setTimeout(() => { state.currentQ++; nextQuestion(state, screens, config); }, 1200);
  }
}

/* ============================================================
   RESULTS
   ============================================================ */
function showResults(state, screens, config) {
  showScreen(screens, "results");

  const { score, wrongCount, bestStreak } = state;
  let emoji, title, subtitle;

  if (score === TOTAL_QUESTIONS) {
    emoji = "🏆"; title = "PERFECT!"; subtitle = "You got every single one right!";
    launchConfetti(220);
  } else if (score >= REWARD_SCORE) {
    emoji = "🌟"; title = "Brilliant!"; subtitle = `${score} out of ${TOTAL_QUESTIONS} — you're a star!`;
    launchConfetti(110);
  } else if (score >= 5) {
    emoji = "😊"; title = "Good try!"; subtitle = `${score} out of ${TOTAL_QUESTIONS} — keep going!`;
  } else {
    emoji = "💪"; title = "Keep going!"; subtitle = "Practice makes perfect — you've got this!";
  }

  document.getElementById("result-emoji").textContent    = emoji;
  document.getElementById("result-title").textContent    = title;
  document.getElementById("result-subtitle").textContent = subtitle;
  document.getElementById("res-correct").textContent     = score;
  document.getElementById("res-wrong").textContent       = wrongCount;
  document.getElementById("res-streak").textContent      = bestStreak;
  document.getElementById("result-stars").textContent    = starsFor(score);

  if (score >= REWARD_SCORE || bestStreak >= REWARD_STREAK) {
    fireReward({ score, total: TOTAL_QUESTIONS, streak: bestStreak, perfect: score === TOTAL_QUESTIONS });
  }
}

function starsFor(score) {
  if (score === TOTAL_QUESTIONS) return "⭐⭐⭐";
  if (score >= REWARD_SCORE)     return "⭐⭐";
  if (score >= 5)                return "⭐";
  return "";
}

/* ============================================================
   HA REWARD
   ============================================================ */
async function fireReward(data) {
  try {
    await fetch("/api/reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.warn("Could not fire reward:", e);
  }
}

/* ============================================================
   HUD + PROGRESS
   ============================================================ */
function updateHUD(state) {
  document.getElementById("hud-score").textContent  = state.score;
  document.getElementById("hud-q").textContent      = `${state.currentQ + 1} / ${TOTAL_QUESTIONS}`;
  document.getElementById("hud-streak").textContent = state.streak;
}

function updateProgress(state) {
  document.getElementById("progress-bar").style.width =
    ((state.currentQ / TOTAL_QUESTIONS) * 100) + "%";
}

/* ============================================================
   FEEDBACK + ANIMATION
   ============================================================ */
function showFeedback(type, msg) {
  const el = document.getElementById("feedback");
  el.textContent = msg;
  el.className   = "feedback-msg " + type;
}

function animateCard(cls) {
  const card = document.getElementById("question-card");
  card.classList.remove("shake", "pop");
  void card.offsetWidth; // force reflow
  card.classList.add(cls);
}

const PHRASES = [
  "Correct! 🎉", "Well done! ✅", "Nailed it! 🌟",
  "Spot on! 👏", "Brilliant! 🚀", "You got it! 💯",
  "Amazing! 🏅", "Super! ⚡", "That's right! 🎯",
  "Fantastic! 🦄", "Excellent! 🔥",
];
function pickPhrase() { return PHRASES[randInt(0, PHRASES.length - 1)]; }

/* ============================================================
   WRONG ANSWER GENERATION
   ============================================================ */
function wrongAnswers(correct, count) {
  const set = new Set();
  let tries = 0;
  while (set.size < count && tries < 120) {
    tries++;
    const delta = randInt(-4, 4) * randInt(1, 3);
    const c = correct + delta;
    if (c > 0 && c !== correct) set.add(c);
  }
  let fill = correct + 1;
  while (set.size < count) { if (fill !== correct) set.add(fill); fill++; }
  return [...set].slice(0, count);
}

/* ============================================================
   CONFETTI
   ============================================================ */
function launchConfetti(count = 120) {
  const canvas = document.getElementById("confetti-canvas");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");

  const COLORS = ["#ff8c00","#3b82f6","#22c55e","#ec4899","#eab308","#a855f7","#e74c3c"];
  const pieces = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height * 0.5,
    r: randInt(6, 11),
    d: Math.random() * 3.5 + 1.5,
    col: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.random() * 360,
    rV: (Math.random() - 0.5) * 5,
    xV: (Math.random() - 0.5) * 2.5,
  }));

  let frame;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      if (p.y < canvas.height + 20) alive = true;
      p.y += p.d; p.x += p.xV; p.rot += p.rV;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5);
      ctx.restore();
    });
    if (alive) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}

/* ============================================================
   UTILS
   ============================================================ */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
