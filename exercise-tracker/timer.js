// ---- View toggle (exercises <-> chrono) ----
const viewToggleBtn = document.getElementById("view-toggle-btn");
const exercisesView = document.getElementById("exercises-view");
const timerView = document.getElementById("timer-view");

function updateViewToggleLabel() {
  viewToggleBtn.textContent = timerView.hidden ? t("nav.toChrono") : t("nav.toExercises");
}

viewToggleBtn.addEventListener("click", () => {
  const showingTimer = !timerView.hidden;
  timerView.hidden = showingTimer;
  exercisesView.hidden = !showingTimer;
  updateViewToggleLabel();
});

updateViewToggleLabel();

function formatTime(totalSeconds) {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  const centis = Math.floor((clamped % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

// ---- Beep (Web Audio API, no external files) ----
let audioCtx = null;
function beep(freq = 880, durationMs = 150) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + durationMs / 1000);
}

// ---- Completion notification (works while the app is backgrounded, not after it's fully closed) ----
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showCompletionNotification(name) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = t("notif.title");
  const body = name ? `${name} — ${t("notif.body")}` : t("notif.body");
  const options = { body, icon: "icon-192.png", badge: "icon-192.png", tag: "chrono-done" };
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, options)).catch(() => {
      new Notification(title, options);
    });
  } else {
    new Notification(title, options);
  }
}

let notifyTimeoutId = null;

function clearScheduledNotification() {
  if (notifyTimeoutId) {
    clearTimeout(notifyTimeoutId);
    notifyTimeoutId = null;
  }
}

function scheduleNotification(remainingSeconds, name) {
  clearScheduledNotification();
  notifyTimeoutId = setTimeout(() => showCompletionNotification(name), Math.max(0, remainingSeconds * 1000));
}

// ---- Chrono ----
const timerDisplay = document.getElementById("timer-display");
const timerStartBtn = document.getElementById("timer-start-btn");
const timerResetBtn = document.getElementById("timer-reset-btn");
const lapBtn = document.getElementById("lap-btn");
const lapListEl = document.getElementById("lap-list");
const lapRowTemplate = document.getElementById("lap-row-template");

let running = false;
let startTimestamp = 0;
let elapsedSeconds = 0;
let animationHandle = null;
let laps = [];
let countdownTarget = null; // null = stopwatch mode, number = countdown seconds
let countdownName = null;
let timerBtnState = "start"; // "start" | "pause" | "resume"

function setTimerBtnState(state) {
  timerBtnState = state;
  timerStartBtn.textContent = t(`timer.${state}`);
}

function getElapsedSeconds() {
  return running ? elapsedSeconds + (Date.now() - startTimestamp) / 1000 : elapsedSeconds;
}

function updateDisplay() {
  const elapsed = getElapsedSeconds();

  if (countdownTarget !== null) {
    const remaining = countdownTarget - elapsed;
    if (remaining <= 0) {
      beep(660, 400);
      clearScheduledNotification();
      running = false;
      cancelAnimationFrame(animationHandle);
      countdownTarget = null;
      countdownName = null;
      elapsedSeconds = 0;
      setTimerBtnState("start");
      timerDisplay.textContent = formatTime(0);
      return;
    }
    timerDisplay.textContent = formatTime(remaining);
  } else {
    timerDisplay.textContent = formatTime(elapsed);
  }

  if (running) {
    animationHandle = requestAnimationFrame(updateDisplay);
  }
}

timerStartBtn.addEventListener("click", () => {
  if (running) {
    elapsedSeconds += (Date.now() - startTimestamp) / 1000;
    running = false;
    cancelAnimationFrame(animationHandle);
    clearScheduledNotification();
    setTimerBtnState("resume");
  } else {
    startTimestamp = Date.now();
    running = true;
    if (countdownTarget !== null) {
      scheduleNotification(countdownTarget - elapsedSeconds, countdownName);
    }
    updateDisplay();
    setTimerBtnState("pause");
  }
});

timerResetBtn.addEventListener("click", () => {
  running = false;
  cancelAnimationFrame(animationHandle);
  clearScheduledNotification();
  elapsedSeconds = 0;
  countdownTarget = null;
  countdownName = null;
  setTimerBtnState("start");
  laps = [];
  renderLaps();
  updateDisplay();
});

function startCountdown(seconds, name) {
  running = false;
  cancelAnimationFrame(animationHandle);
  elapsedSeconds = 0;
  laps = [];
  renderLaps();
  countdownTarget = seconds;
  countdownName = name || null;
  startTimestamp = Date.now();
  running = true;
  scheduleNotification(seconds, countdownName);
  updateDisplay();
  setTimerBtnState("pause");
}

lapBtn.addEventListener("click", () => {
  beep(880, 100);
  laps.push({ id: crypto.randomUUID(), index: laps.length + 1, seconds: getElapsedSeconds() });
  renderLaps();
});

function renderLaps() {
  lapListEl.innerHTML = "";
  laps.forEach((lap) => {
    const node = lapRowTemplate.content.cloneNode(true);
    node.querySelector(".lap-row-label").textContent = `${t("timer.lapLabel")} ${lap.index}`;
    node.querySelector(".lap-row-time").textContent = formatTime(lap.seconds);
    const lapDeleteBtn = node.querySelector(".lap-delete-btn");
    lapDeleteBtn.title = t("delete.title");
    lapDeleteBtn.addEventListener("click", () => {
      laps = laps.filter((l) => l.id !== lap.id);
      renderLaps();
    });
    lapListEl.appendChild(node);
  });
}

// ---- Chronos prédéfinis ----
const PRESETS_STORAGE_KEY = "exercise-tracker-presets";
const presetListEl = document.getElementById("preset-list");
const presetEmptyStateEl = document.getElementById("preset-empty-state");
const presetTemplate = document.getElementById("preset-template");
const addPresetForm = document.getElementById("add-preset-form");
const presetNameInput = document.getElementById("preset-name-input");
const presetMinutesInput = document.getElementById("preset-minutes-input");
const presetSecondsInput = document.getElementById("preset-seconds-input");

let presets = loadPresets();

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets() {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

function renderPresets() {
  presetListEl.innerHTML = "";
  presetEmptyStateEl.classList.toggle("visible", presets.length === 0);

  presets.forEach((preset) => {
    const node = presetTemplate.content.cloneNode(true);
    const nameInput = node.querySelector(".preset-name");
    nameInput.value = preset.name;
    nameInput.placeholder = t("presets.rowNamePlaceholder");

    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") nameInput.blur();
    });

    nameInput.addEventListener("blur", () => {
      nameInput.readOnly = true;
      const newName = nameInput.value.trim();
      if (!newName) {
        nameInput.value = preset.name;
        return;
      }
      if (newName === preset.name) return;
      preset.name = newName;
      savePresets();
      renderPresets();
    });

    const editBtn = node.querySelector(".edit-btn");
    editBtn.title = t("edit.title");
    editBtn.addEventListener("click", () => {
      nameInput.readOnly = false;
      nameInput.focus();
      nameInput.select();
    });

    const fieldLabels = node.querySelectorAll(".inline-field-label");
    fieldLabels[0].textContent = t("field.min");
    fieldLabels[1].textContent = t("field.sec");

    const minutesInput = node.querySelector(".preset-minutes");
    const secondsInput = node.querySelector(".preset-seconds");
    minutesInput.value = Math.floor(preset.seconds / 60);
    secondsInput.value = preset.seconds % 60;

    const updatePresetDuration = () => {
      const min = Math.max(0, Math.round(Number(minutesInput.value) || 0));
      const sec = Math.max(0, Math.min(59, Math.round(Number(secondsInput.value) || 0)));
      minutesInput.value = min;
      secondsInput.value = sec;
      preset.seconds = Math.max(1, min * 60 + sec);
      savePresets();
    };

    minutesInput.addEventListener("change", updatePresetDuration);
    secondsInput.addEventListener("change", updatePresetDuration);

    const playBtn = node.querySelector(".play-btn");
    playBtn.title = t("presets.playTitle");
    playBtn.addEventListener("click", () => {
      requestNotificationPermission();
      startCountdown(preset.seconds, preset.name);
    });

    const deleteBtn = node.querySelector(".delete-btn");
    deleteBtn.title = t("delete.title");
    deleteBtn.addEventListener("click", () => {
      window.openConfirmModal(t("modal.deletePreset", { name: preset.name }), () => {
        presets = presets.filter((p) => p.id !== preset.id);
        savePresets();
        renderPresets();
      });
    });

    presetListEl.appendChild(node);
  });
}

addPresetForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = presetNameInput.value.trim();
  const minutes = Math.max(0, Math.round(Number(presetMinutesInput.value) || 0));
  const secondsPart = Math.max(0, Math.round(Number(presetSecondsInput.value) || 0));
  const seconds = minutes * 60 + secondsPart;
  if (!name || seconds <= 0) return;
  presets.push({ id: crypto.randomUUID(), name, seconds });
  savePresets();
  renderPresets();
  presetNameInput.value = "";
  presetMinutesInput.value = "";
  presetSecondsInput.value = "";
  presetNameInput.focus();
});

document.addEventListener("languagechange", () => {
  updateViewToggleLabel();
  setTimerBtnState(timerBtnState);
  renderLaps();
  renderPresets();
});

renderPresets();
updateDisplay();
