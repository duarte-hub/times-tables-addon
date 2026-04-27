/* =====================================================
   Times Tables Game — app.js
   ===================================================== */

// ---------- STATE ----------
const state = {
  playerName: "Player",
  selectedTables: [2, 5, 10],
  mixMode: false,

  // game session
  questions: [],
  currentQ: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  wrongCount: 0,
  answering: true,
};

const TOTAL_QUESTIONS = 10;

// Reward thresholds (fired as separate event types via /api/reward)
const REWARD_PERFECT   = 10;   // perfect score
const REWARD_GOOD      = 8;    // good score
const REWARD_STREAK    = 5;    // streak of 5+

// ---------- DOM REFS ----------
const $ = (id) => document.getElementById(id);

const screens = {
  welcome: $("screen-welcome"),
  game:    $("screen-game"),
  results: $("screen-results"),
};

// ---------- BOOT ----------
window.addEventListener("DOMContentLoaded", async () => {
  buildTableButtons();
  await loadPlayerName();

  $("btn-start").addEventListener("click", startGame);
  $("btn-play-again").addEventListener("click", () => {
    showScreen("game");
    runGame();
  });
  $("btn-change-table").addEventListener("click", () => showScreen("welcome"));
  $("mix-mode").addEventListener("change", (e) => {
    state.mixMode = e.target.checked;
  });

  showScreen("welcome");
});

async function loadPlayerName() {
  try {
    const res = await fetch("/api/options");
    if (res.ok) {
      const opts = await res.json();
      if (opts.player_name) {
        state.playerName = opts.player_name;
        $("welcome-name").textContent = `Hi ${opts.player_name}! Let's practise! 🌟`;
      }
    }
  } catch (_) { /* offline / dev */ }
}

// ---------- SCREENS ----------
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ---------- TABLE PICKER ----------
function buildTableButtons() {
  const container = $("table-buttons");
  for (let t = 1; t <= 12; t++) {
    const btn = document.createElement("button");
    btn.className = "tbl-btn" + (state.selectedTables.includes(t) ? " active" : "");
    btn.textContent = t;
    btn.dataset.table = t;
    btn.addEventListener("click", () => toggleTable(t, btn));
    container.appendChild(btn);
  }
}

function toggleTable(t, btn) {
  const idx = state.selectedTables.indexOf(t);
  if (idx === -1) {
    state.selectedTables.push(t);
    btn.classList.add("active");
  } else {
    if (state.selectedTables.length === 1) return; // keep at least one
    state.selectedTables.splice(idx, 1);
    btn.classList.remove("active");
  }
}

// ---------- GAME SETUP ----------
function startGame() {
  if (state.selectedTables.length === 0) return;
  showScreen("game");
  runGame();
}

function runGame() {
  state.questions = generateQuestions();
  state.currentQ  = 0;
  state.score      = 0;
  state.streak     = 0;
  state.bestStreak = 0;
  state.wrongCount = 0;
  updateHUD();
  showQuestion();
}

// ---------- QUESTION GENERATION ----------
function generateQuestions() {
  const qs = [];
  const tables = [...state.selectedTables];

  for (let i = 0; i < TOTAL_QUESTIONS; i++) {
    const table = state.mixMode
      ? tables[Math.floor(Math.random() * tables.length)]
      : tables[i % tables.length];  // cycle through selected tables evenly

    const multiplier = randInt(1, 12);
    qs.push({ table, multiplier, answer: table * multiplier });
  }
  return shuffle(qs);
}

// ---------- QUESTION DISPLAY ----------
function showQuestion() {
  if (state.currentQ >= TOTAL_QUESTIONS) {
    showResults();
    return;
  }

  const q = state.questions[state.currentQ];
  $("question-text").textContent = `${q.table} × ${q.multiplier} = ?`;
  $("feedback").textContent = "";
  $("feedback").className = "feedback";
  updateProgress();

  // Generate 3 wrong answers
  const wrongs = generateWrongAnswers(q.answer, 3);
  const options = shuffle([q.answer, ...wrongs]);

  const choicesEl = $("choices");
  choicesEl.innerHTML = "";
  options.forEach((val) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = val;
    btn.addEventListener("click", () => handleAnswer(val, q.answer, btn));
    choicesEl.appendChild(btn);
  });

  state.answering = true;
}

function generateWrongAnswers(correct, count) {
  const wrongs = new Set();
  let attempts = 0;
  while (wrongs.size < count && attempts < 100) {
    attempts++;
    // Generate plausible-looking wrong answers near the correct one
    const delta = randInt(-3, 3) * randInt(1, 4);
    const candidate = correct + delta;
    if (candidate > 0 && candidate !== correct) wrongs.add(candidate);
  }
  // Fallback: fill with sequential wrong answers
  let fill = correct + 1;
  while (wrongs.size < count) {
    if (fill !== correct) wrongs.add(fill);
    fill++;
  }
  return [...wrongs].slice(0, count);
}

// ---------- ANSWER HANDLING ----------
function handleAnswer(chosen, correct, btn) {
  if (!state.answering) return;
  state.answering = false;

  // Disable all buttons
  document.querySelectorAll(".choice-btn").forEach((b) => (b.disabled = true));

  if (chosen === correct) {
    // Correct!
    state.score++;
    state.streak++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;

    btn.classList.add("correct-ans");
    showFeedback("correct", pickCorrectPhrase());
    animateCard("pop");
    updateHUD();

    setTimeout(() => {
      state.currentQ++;
      showQuestion();
    }, 900);

  } else {
    // Wrong
    state.streak = 0;
    state.wrongCount++;

    btn.classList.add("wrong-ans");
    // Highlight the correct answer
    document.querySelectorAll(".choice-btn").forEach((b) => {
      if (parseInt(b.textContent) === correct) b.classList.add("correct-ans");
    });

    showFeedback("wrong", `${correct} was the answer`);
    animateCard("shake");
    updateHUD();

    setTimeout(() => {
      state.currentQ++;
      showQuestion();
    }, 1200);
  }
}

// ---------- RESULTS ----------
function showResults() {
  showScreen("results");

  const score     = state.score;
  const pct       = score / TOTAL_QUESTIONS;
  const streak    = state.bestStreak;

  // Emoji & title
  let emoji, title, subtitle;
  if (score === TOTAL_QUESTIONS) {
    emoji    = "🏆";
    title    = "PERFECT!";
    subtitle = "You got every single one right! Amazing!";
    launchConfetti(200);
  } else if (score >= REWARD_GOOD) {
    emoji    = "⭐";
    title    = "Brilliant!";
    subtitle = `${score} out of ${TOTAL_QUESTIONS} — you're a star!`;
    launchConfetti(100);
  } else if (score >= 5) {
    emoji    = "😊";
    title    = "Good try!";
    subtitle = `${score} out of ${TOTAL_QUESTIONS} — keep practising!`;
  } else {
    emoji    = "💪";
    title    = "Keep going!";
    subtitle = "Practice makes perfect — you've got this!";
  }

  $("result-emoji").textContent     = emoji;
  $("result-title").textContent     = title;
  $("result-subtitle").textContent  = subtitle;
  $("res-correct").textContent      = score;
  $("res-wrong").textContent        = state.wrongCount;
  $("res-streak").textContent       = streak;
  $("result-stars").textContent     = "⭐".repeat(starsFor(score));

  // Fire HA reward if earned
  if (score >= REWARD_GOOD || streak >= REWARD_STREAK) {
    fireReward({ score, total: TOTAL_QUESTIONS, streak, perfect: score === TOTAL_QUESTIONS });
  }
}

function starsFor(score) {
  if (score === TOTAL_QUESTIONS) return 3;
  if (score >= REWARD_GOOD)      return 2;
  if (score >= 5)                return 1;
  return 0;
}

// ---------- HA REWARD ----------
async function fireReward(data) {
  try {
    await fetch("/api/reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score:   data.score,
        total:   data.total,
        streak:  data.streak,
        perfect: data.perfect,
        level:   state.selectedTables.join(","),
      }),
    });
    console.log("Reward event fired:", data);
  } catch (e) {
    console.warn("Could not fire reward event:", e);
  }
}

// ---------- HUD & PROGRESS ----------
function updateHUD() {
  $("hud-score").textContent  = state.score;
  $("hud-q").textContent      = `${state.currentQ + 1} / ${TOTAL_QUESTIONS}`;
  $("hud-streak").textContent = state.streak;
}

function updateProgress() {
  const pct = (state.currentQ / TOTAL_QUESTIONS) * 100;
  $("progress-bar").style.width = pct + "%";
}

// ---------- FEEDBACK & ANIMATION ----------
function showFeedback(type, msg) {
  const el = $("feedback");
  el.textContent = msg;
  el.className   = "feedback " + type;
}

function animateCard(cls) {
  const card = $("question-card");
  card.classList.remove("shake", "pop");
  // Force reflow
  void card.offsetWidth;
  card.classList.add(cls);
}

const CORRECT_PHRASES = [
  "Correct! 🎉", "Well done! ✅", "Nailed it! 🌟",
  "Spot on! 👏", "Brilliant! 🚀", "You got it! 💯",
  "Amazing! 🏅", "Super! ⚡", "That's right! 🎯",
];
function pickCorrectPhrase() {
  return CORRECT_PHRASES[Math.floor(Math.random() * CORRECT_PHRASES.length)];
}

// ---------- CONFETTI ----------
function launchConfetti(count = 120) {
  const canvas = $("confetti-canvas");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");

  const COLORS = ["#7c3aed","#ec4899","#10b981","#f59e0b","#3b82f6","#a78bfa","#fff"];
  const pieces = Array.from({ length: count }, () => ({
    x:   Math.random() * canvas.width,
    y:   -Math.random() * canvas.height * 0.5,
    r:   randInt(5, 10),
    d:   Math.random() * 4 + 2,
    col: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.random() * 360,
    rV:  (Math.random() - 0.5) * 4,
    xV:  (Math.random() - 0.5) * 2,
  }));

  let frame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach((p) => {
      if (p.y < canvas.height + 20) alive = true;
      p.y   += p.d;
      p.x   += p.xV;
      p.rot += p.rV;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
      ctx.restore();
    });
    if (alive) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  cancelAnimationFrame(frame);
  draw();
}

// ---------- UTILS ----------
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
