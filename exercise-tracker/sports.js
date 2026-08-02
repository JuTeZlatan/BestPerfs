const SPORTS_STORAGE_KEY = "exercise-tracker-sports";

const sportSelectorEl = document.getElementById("sport-selector");
const sportListEl = document.getElementById("sport-list");
const sportEmptyStateEl = document.getElementById("sport-empty-state");

const swimTemplate = document.getElementById("swim-perf-template");
const cyclingTemplate = document.getElementById("cycling-perf-template");
const runningTemplate = document.getElementById("running-perf-template");

const addSwimForm = document.getElementById("add-swim-form");
const swimStyleInput = document.getElementById("swim-style-input");
const swimDistanceInput = document.getElementById("swim-distance-input");
const swimMinutesInput = document.getElementById("swim-minutes-input");
const swimSecondsInput = document.getElementById("swim-seconds-input");

const addCyclingForm = document.getElementById("add-cycling-form");
const cyclingDistanceInput = document.getElementById("cycling-distance-input");
const cyclingMinutesInput = document.getElementById("cycling-minutes-input");
const cyclingSecondsInput = document.getElementById("cycling-seconds-input");

const addRunningForm = document.getElementById("add-running-form");
const runningDescInput = document.getElementById("running-desc-input");
const runningMinutesInput = document.getElementById("running-minutes-input");
const runningSecondsInput = document.getElementById("running-seconds-input");

const SPORT_FORMS = { natation: addSwimForm, velo: addCyclingForm, course: addRunningForm };
const SPORT_TEMPLATES = { natation: swimTemplate, velo: cyclingTemplate, course: runningTemplate };

let currentSport = "natation";
let sportPerfs = loadSportPerfs();

function loadSportPerfs() {
  try {
    const raw = localStorage.getItem(SPORTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      natation: parsed.natation || [],
      velo: parsed.velo || [],
      course: parsed.course || [],
    };
  } catch {
    return { natation: [], velo: [], course: [] };
  }
}

function saveSportPerfs() {
  localStorage.setItem(SPORTS_STORAGE_KEY, JSON.stringify(sportPerfs));
}

function selectSport(sport) {
  currentSport = sport;
  sportSelectorEl.querySelectorAll(".sport-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sport === sport);
  });
  Object.keys(SPORT_FORMS).forEach((key) => {
    SPORT_FORMS[key].hidden = key !== sport;
  });
  renderSportList();
}

sportSelectorEl.querySelectorAll(".sport-tab").forEach((btn) => {
  btn.addEventListener("click", () => selectSport(btn.dataset.sport));
});

function renderSportList() {
  sportListEl.innerHTML = "";
  const entries = sportPerfs[currentSport];
  sportEmptyStateEl.classList.toggle("visible", entries.length === 0);

  const template = SPORT_TEMPLATES[currentSport];

  entries.forEach((perf) => {
    const node = template.content.cloneNode(true);

    const textInput = node.querySelector(".perf-text");
    if (textInput) {
      textInput.value = perf.text;
      textInput.placeholder = currentSport === "natation" ? t("sport.swim.stylePlaceholder") : t("sport.running.descPlaceholder");

      textInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") textInput.blur();
      });

      textInput.addEventListener("blur", () => {
        textInput.readOnly = true;
        const newText = textInput.value.trim();
        if (!newText) {
          textInput.value = perf.text;
          return;
        }
        if (newText === perf.text) return;
        perf.text = newText;
        saveSportPerfs();
        renderSportList();
      });

      const editBtn = node.querySelector(".edit-btn");
      editBtn.title = t("edit.title");
      editBtn.addEventListener("click", () => {
        textInput.readOnly = false;
        textInput.focus();
        textInput.select();
      });
    }

    const fieldLabels = node.querySelectorAll(".inline-field-label");
    const distanceInput = node.querySelector(".perf-distance");
    const minutesInput = node.querySelector(".perf-minutes");
    const secondsInput = node.querySelector(".perf-seconds");

    if (distanceInput) {
      distanceInput.value = perf.distance ?? "";
      distanceInput.addEventListener("input", () => {
        perf.distance = distanceInput.value === "" ? null : Number(distanceInput.value);
        saveSportPerfs();
      });
    }

    minutesInput.value = perf.minutes ?? "";
    secondsInput.value = perf.seconds ?? "";

    minutesInput.addEventListener("input", () => {
      perf.minutes = minutesInput.value === "" ? null : Number(minutesInput.value);
      saveSportPerfs();
    });

    secondsInput.addEventListener("input", () => {
      perf.seconds = secondsInput.value === "" ? null : Number(secondsInput.value);
      saveSportPerfs();
    });

    if (currentSport === "course") {
      fieldLabels[0].textContent = t("field.min");
      fieldLabels[1].textContent = t("field.sec");
    } else {
      fieldLabels[1].textContent = t("field.min");
      fieldLabels[2].textContent = t("field.sec");
    }

    const deleteBtn = node.querySelector(".delete-btn");
    deleteBtn.title = t("delete.title");
    deleteBtn.addEventListener("click", () => {
      window.openConfirmModal(t("modal.deletePerf"), () => {
        sportPerfs[currentSport] = sportPerfs[currentSport].filter((p) => p.id !== perf.id);
        saveSportPerfs();
        renderSportList();
      });
    });

    sportListEl.appendChild(node);
  });
}

addSwimForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = swimStyleInput.value.trim();
  if (!text) return;
  sportPerfs.natation.push({
    id: crypto.randomUUID(),
    text,
    distance: swimDistanceInput.value === "" ? null : Number(swimDistanceInput.value),
    minutes: swimMinutesInput.value === "" ? null : Number(swimMinutesInput.value),
    seconds: swimSecondsInput.value === "" ? null : Number(swimSecondsInput.value),
  });
  saveSportPerfs();
  renderSportList();
  addSwimForm.reset();
  swimStyleInput.focus();
});

addCyclingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (cyclingDistanceInput.value === "") return;
  sportPerfs.velo.push({
    id: crypto.randomUUID(),
    distance: Number(cyclingDistanceInput.value),
    minutes: cyclingMinutesInput.value === "" ? null : Number(cyclingMinutesInput.value),
    seconds: cyclingSecondsInput.value === "" ? null : Number(cyclingSecondsInput.value),
  });
  saveSportPerfs();
  renderSportList();
  addCyclingForm.reset();
  cyclingDistanceInput.focus();
});

addRunningForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = runningDescInput.value.trim();
  if (!text) return;
  sportPerfs.course.push({
    id: crypto.randomUUID(),
    text,
    minutes: runningMinutesInput.value === "" ? null : Number(runningMinutesInput.value),
    seconds: runningSecondsInput.value === "" ? null : Number(runningSecondsInput.value),
  });
  saveSportPerfs();
  renderSportList();
  addRunningForm.reset();
  runningDescInput.focus();
});

document.addEventListener("languagechange", renderSportList);

selectSport("natation");
