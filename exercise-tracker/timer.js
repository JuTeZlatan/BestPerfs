// ---- View navigation (chrono / sports / profile) ----
const navTabs = document.querySelectorAll(".bottom-nav-btn");
const timerView = document.getElementById("timer-view");
const sportsView = document.getElementById("sports-view");
const classementView = document.getElementById("classement-view");
const challengesView = document.getElementById("challenges-view");
const profileView = document.getElementById("profile-view");
const NAV_VIEWS = { timer: timerView, classement: classementView, sports: sportsView, challenges: challengesView, profile: profileView };

function showView(name) {
  Object.keys(NAV_VIEWS).forEach((key) => {
    NAV_VIEWS[key].hidden = key !== name;
  });
  navTabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));
}
window.showView = showView;

navTabs.forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

// ---- Chrono: Classique / Répétition slidable tab pair ----
const timerMainTabBtns = Array.from(document.getElementById("timer-main-tab-bar").querySelectorAll(".friends-tab-btn"));
const timerTabTrack = document.getElementById("timer-tab-track");

function setTimerActiveTab(index) {
  timerMainTabBtns.forEach((btn, i) => btn.classList.toggle("active", i === index));
  timerTabTrack.style.transform = `translateX(-${index * 100}%)`;
}

timerMainTabBtns.forEach((btn, index) => {
  btn.addEventListener("click", () => setTimerActiveTab(index));
});

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

// ---- Completion notification ----
// Web: a JS setTimeout + Notification API, works while the app is backgrounded, not after it's fully closed.
// Native (Android): an OS-scheduled local notification via @capacitor/local-notifications, so it still
// fires even if the WebView's JS timers get throttled/paused while the app is backgrounded.
const isNativePlatform = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
const NATIVE_NOTIF_ID = 1;

function requestNotificationPermission() {
  if (isNativePlatform) {
    Capacitor.Plugins.LocalNotifications.requestPermissions().catch(() => {});
    return;
  }
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

function scheduleNativeNotification(remainingSeconds, name) {
  if (!isNativePlatform) return;
  const title = t("notif.title");
  const body = name ? `${name} — ${t("notif.body")}` : t("notif.body");
  const at = new Date(Date.now() + Math.max(0, remainingSeconds * 1000));
  Capacitor.Plugins.LocalNotifications.schedule({
    notifications: [{ id: NATIVE_NOTIF_ID, title, body, schedule: { at } }],
  }).catch(() => {});
}

function cancelNativeNotification() {
  if (!isNativePlatform) return;
  Capacitor.Plugins.LocalNotifications.cancel({ notifications: [{ id: NATIVE_NOTIF_ID }] }).catch(() => {});
}

let notifyTimeoutId = null;

function clearScheduledNotification() {
  if (notifyTimeoutId) {
    clearTimeout(notifyTimeoutId);
    notifyTimeoutId = null;
  }
  cancelNativeNotification();
}

function scheduleNotification(remainingSeconds, name) {
  clearScheduledNotification();
  notifyTimeoutId = setTimeout(() => showCompletionNotification(name), Math.max(0, remainingSeconds * 1000));
  scheduleNativeNotification(remainingSeconds, name);
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

// ---- Chrono à répétition: alternates Travail/Pause indefinitely until
// stopped. The phase and remaining time are derived from total elapsed time
// modulo the work+rest cycle length rather than switched one phase at a
// time, so the display is instantly correct even after the tab was
// backgrounded across several cycles. ----
const INTERVAL_SETTINGS_KEY = "exercise-tracker-interval-settings";
const intervalDisplay = document.getElementById("interval-display");
const intervalPhaseLabelEl = document.getElementById("interval-phase-label");
const intervalCycleCountEl = document.getElementById("interval-cycle-count");
const intervalSetupEl = document.getElementById("interval-setup");
const intervalWorkHoursInput = document.getElementById("interval-work-hours-input");
const intervalWorkMinutesInput = document.getElementById("interval-work-minutes-input");
const intervalWorkSecondsInput = document.getElementById("interval-work-seconds-input");
const intervalRestHoursInput = document.getElementById("interval-rest-hours-input");
const intervalRestMinutesInput = document.getElementById("interval-rest-minutes-input");
const intervalRestSecondsInput = document.getElementById("interval-rest-seconds-input");
const intervalInfiniteCheckbox = document.getElementById("interval-infinite-checkbox");
const intervalRepsInput = document.getElementById("interval-reps-input");
const intervalStartBtn = document.getElementById("interval-start-btn");
const intervalResetBtn = document.getElementById("interval-reset-btn");

function loadIntervalSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INTERVAL_SETTINGS_KEY));
    return {
      workSeconds: Math.max(0, Number(parsed.workSeconds) || 0),
      restSeconds: Math.max(0, Number(parsed.restSeconds) || 0),
      maxCycles: parsed.maxCycles == null ? null : Math.max(1, Number(parsed.maxCycles) || 1),
    };
  } catch {
    return { workSeconds: 60, restSeconds: 180, maxCycles: null };
  }
}

function saveIntervalSettings(workSeconds, restSeconds, maxCycles) {
  localStorage.setItem(INTERVAL_SETTINGS_KEY, JSON.stringify({ workSeconds, restSeconds, maxCycles }));
}

const intervalSaved = loadIntervalSettings();
intervalWorkHoursInput.value = Math.floor(intervalSaved.workSeconds / 3600);
intervalWorkMinutesInput.value = Math.floor((intervalSaved.workSeconds % 3600) / 60);
intervalWorkSecondsInput.value = intervalSaved.workSeconds % 60;
intervalRestHoursInput.value = Math.floor(intervalSaved.restSeconds / 3600);
intervalRestMinutesInput.value = Math.floor((intervalSaved.restSeconds % 3600) / 60);
intervalRestSecondsInput.value = intervalSaved.restSeconds % 60;
intervalInfiniteCheckbox.checked = intervalSaved.maxCycles == null;
intervalRepsInput.hidden = intervalSaved.maxCycles == null;
if (intervalSaved.maxCycles != null) intervalRepsInput.value = intervalSaved.maxCycles;

intervalInfiniteCheckbox.addEventListener("change", () => {
  intervalRepsInput.hidden = intervalInfiniteCheckbox.checked;
});

let intervalWorkSeconds = intervalSaved.workSeconds;
let intervalRestSeconds = intervalSaved.restSeconds;
let intervalMaxCycles = intervalSaved.maxCycles; // null = infinite, else a positive number of pauses
let intervalRunning = false;
let intervalElapsedBeforePause = 0;
let intervalStartTimestamp = 0;
let intervalAnimationHandle = null;
let intervalBtnState = "start"; // "start" | "pause" | "resume"
let intervalLastPhaseWasWork = null;
let intervalLastCycleIndex = -1;

function setIntervalBtnState(state) {
  intervalBtnState = state;
  intervalStartBtn.textContent = t(`timer.${state}`);
}

function intervalGetElapsedSeconds() {
  return intervalRunning ? intervalElapsedBeforePause + (Date.now() - intervalStartTimestamp) / 1000 : intervalElapsedBeforePause;
}

function resetIntervalState() {
  intervalRunning = false;
  cancelAnimationFrame(intervalAnimationHandle);
  clearScheduledNotification();
  intervalElapsedBeforePause = 0;
  intervalLastPhaseWasWork = null;
  intervalLastCycleIndex = -1;
  setIntervalBtnState("start");
  intervalSetupEl.hidden = false;
  intervalPhaseLabelEl.textContent = t("timer.intervalWork");
  intervalPhaseLabelEl.classList.remove("rest");
  intervalDisplay.classList.remove("phase-rest");
  intervalDisplay.textContent = formatTime(intervalWorkSeconds);
  intervalCycleCountEl.textContent = "0";
}

function updateIntervalDisplay() {
  const cycleLength = intervalWorkSeconds + intervalRestSeconds;
  if (cycleLength <= 0) return;
  const elapsed = intervalGetElapsedSeconds();
  const cycleIndex = Math.floor(elapsed / cycleLength);

  if (intervalMaxCycles !== null && cycleIndex >= intervalMaxCycles) {
    beep(660, 400);
    scheduleNotification(0, t("timer.intervalTab"));
    resetIntervalState();
    return;
  }

  const posInCycle = elapsed - cycleIndex * cycleLength;
  const isWork = posInCycle < intervalWorkSeconds;
  const remaining = isWork ? intervalWorkSeconds - posInCycle : cycleLength - posInCycle;
  const completedReps = isWork ? cycleIndex : cycleIndex + 1;

  if (intervalRunning && intervalLastPhaseWasWork !== null && (isWork !== intervalLastPhaseWasWork || cycleIndex !== intervalLastCycleIndex)) {
    beep(isWork ? 660 : 880, 250);
    scheduleNotification(remaining, isWork ? t("timer.intervalWork") : t("timer.intervalRest"));
  }
  intervalLastPhaseWasWork = isWork;
  intervalLastCycleIndex = cycleIndex;

  intervalPhaseLabelEl.textContent = isWork ? t("timer.intervalWork") : t("timer.intervalRest");
  intervalPhaseLabelEl.classList.toggle("rest", !isWork);
  intervalDisplay.classList.toggle("phase-rest", !isWork);
  intervalDisplay.textContent = formatTime(Math.max(0, remaining));
  intervalCycleCountEl.textContent = String(completedReps);

  if (intervalRunning) {
    intervalAnimationHandle = requestAnimationFrame(updateIntervalDisplay);
  }
}

intervalStartBtn.addEventListener("click", () => {
  if (intervalRunning) {
    intervalElapsedBeforePause += (Date.now() - intervalStartTimestamp) / 1000;
    intervalRunning = false;
    cancelAnimationFrame(intervalAnimationHandle);
    clearScheduledNotification();
    setIntervalBtnState("resume");
    return;
  }

  if (intervalElapsedBeforePause === 0) {
    const workHours = Math.max(0, Math.round(Number(intervalWorkHoursInput.value) || 0));
    const workMinutes = Math.max(0, Math.round(Number(intervalWorkMinutesInput.value) || 0));
    const workSecondsPart = Math.max(0, Math.round(Number(intervalWorkSecondsInput.value) || 0));
    const restHours = Math.max(0, Math.round(Number(intervalRestHoursInput.value) || 0));
    const restMinutes = Math.max(0, Math.round(Number(intervalRestMinutesInput.value) || 0));
    const restSecondsPart = Math.max(0, Math.round(Number(intervalRestSecondsInput.value) || 0));
    intervalWorkSeconds = workHours * 3600 + workMinutes * 60 + workSecondsPart;
    intervalRestSeconds = restHours * 3600 + restMinutes * 60 + restSecondsPart;
    if (intervalWorkSeconds <= 0 || intervalRestSeconds <= 0) return;
    intervalMaxCycles = intervalInfiniteCheckbox.checked ? null : Math.max(1, Math.round(Number(intervalRepsInput.value) || 0));
    saveIntervalSettings(intervalWorkSeconds, intervalRestSeconds, intervalMaxCycles);
    intervalSetupEl.hidden = true;
    intervalLastPhaseWasWork = null;
    intervalLastCycleIndex = -1;
  }

  requestNotificationPermission();
  intervalStartTimestamp = Date.now();
  intervalRunning = true;
  updateIntervalDisplay();
  setIntervalBtnState("pause");
});

intervalResetBtn.addEventListener("click", resetIntervalState);

// ---- Chronos prédéfinis ----
const PRESETS_STORAGE_KEY = "exercise-tracker-presets";
const presetListEl = document.getElementById("preset-list");
const presetEmptyStateEl = document.getElementById("preset-empty-state");
const presetTemplate = document.getElementById("preset-template");
const addPresetForm = document.getElementById("add-preset-form");
const presetNameInput = document.getElementById("preset-name-input");
const presetHoursInput = document.getElementById("preset-hours-input");
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

    const hoursInput = node.querySelector(".preset-hours");
    const minutesInput = node.querySelector(".preset-minutes");
    const secondsInput = node.querySelector(".preset-seconds");
    hoursInput.value = Math.floor(preset.seconds / 3600);
    minutesInput.value = Math.floor((preset.seconds % 3600) / 60);
    secondsInput.value = preset.seconds % 60;

    const updatePresetDuration = () => {
      const hrs = Math.max(0, Math.round(Number(hoursInput.value) || 0));
      const min = Math.max(0, Math.round(Number(minutesInput.value) || 0));
      const sec = Math.max(0, Math.min(59, Math.round(Number(secondsInput.value) || 0)));
      hoursInput.value = hrs;
      minutesInput.value = min;
      secondsInput.value = sec;
      preset.seconds = Math.max(1, hrs * 3600 + min * 60 + sec);
      savePresets();
    };

    hoursInput.addEventListener("change", updatePresetDuration);
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
  const hours = Math.max(0, Math.round(Number(presetHoursInput.value) || 0));
  const minutes = Math.max(0, Math.round(Number(presetMinutesInput.value) || 0));
  const secondsPart = Math.max(0, Math.round(Number(presetSecondsInput.value) || 0));
  const seconds = hours * 3600 + minutes * 60 + secondsPart;
  if (!name || seconds <= 0) return;
  presets.push({ id: crypto.randomUUID(), name, seconds });
  savePresets();
  renderPresets();
  presetNameInput.value = "";
  presetHoursInput.value = "";
  presetMinutesInput.value = "";
  presetSecondsInput.value = "";
  presetNameInput.focus();
});

document.addEventListener("languagechange", () => {
  setTimerBtnState(timerBtnState);
  renderLaps();
  renderPresets();
  setIntervalBtnState(intervalBtnState);
  if (!intervalRunning) {
    intervalPhaseLabelEl.textContent = intervalLastPhaseWasWork === false ? t("timer.intervalRest") : t("timer.intervalWork");
  }
});

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

renderPresets();
updateDisplay();
intervalDisplay.textContent = formatTime(intervalWorkSeconds);
