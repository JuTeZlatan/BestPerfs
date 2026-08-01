const STORAGE_KEY = "habit-tracker-data";
const DAYS_SHOWN = 14;
const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

const listEl = document.getElementById("habit-list");
const formEl = document.getElementById("add-form");
const inputEl = document.getElementById("habit-input");
const emptyStateEl = document.getElementById("empty-state");
const templateEl = document.getElementById("habit-template");

let habits = loadHabits();

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function lastNDates(n) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d);
  }
  return dates;
}

function computeStreak(completedDates) {
  const doneSet = new Set(completedDates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let cursor = new Date(today);
  if (!doneSet.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (doneSet.has(toDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function render() {
  listEl.innerHTML = "";
  emptyStateEl.classList.toggle("visible", habits.length === 0);

  const dates = lastNDates(DAYS_SHOWN);
  const todayKey = toDateKey(new Date());

  habits.forEach((habit) => {
    const node = templateEl.content.cloneNode(true);
    const card = node.querySelector(".habit-card");
    node.querySelector(".habit-name").textContent = habit.name;

    const streak = computeStreak(habit.completedDates);
    const badge = node.querySelector(".streak-badge");
    badge.textContent = streak > 0 ? `🔥 ${streak} jour${streak > 1 ? "s" : ""}` : "Pas de série";

    const grid = node.querySelector(".day-grid");
    dates.forEach((date) => {
      const key = toDateKey(date);
      const cell = document.createElement("div");
      cell.className = "day-cell";

      const label = document.createElement("div");
      label.className = "day-label";
      label.textContent = DAY_LABELS[date.getDay()];

      const box = document.createElement("div");
      box.className = "day-box";
      if (key === todayKey) box.classList.add("today");
      if (habit.completedDates.includes(key)) box.classList.add("done");
      box.title = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });

      box.addEventListener("click", () => toggleDay(habit.id, key));

      cell.appendChild(label);
      cell.appendChild(box);
      grid.appendChild(cell);
    });

    node.querySelector(".delete-btn").addEventListener("click", () => deleteHabit(habit.id));

    listEl.appendChild(node);
  });
}

function toggleDay(habitId, dateKey) {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;
  const idx = habit.completedDates.indexOf(dateKey);
  if (idx === -1) {
    habit.completedDates.push(dateKey);
  } else {
    habit.completedDates.splice(idx, 1);
  }
  saveHabits();
  render();
}

function deleteHabit(habitId) {
  habits = habits.filter((h) => h.id !== habitId);
  saveHabits();
  render();
}

function addHabit(name) {
  habits.push({
    id: crypto.randomUUID(),
    name,
    completedDates: [],
  });
  saveHabits();
  render();
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = inputEl.value.trim();
  if (!name) return;
  addHabit(name);
  inputEl.value = "";
  inputEl.focus();
});

render();
