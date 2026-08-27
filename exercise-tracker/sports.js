const SPORTS_STORAGE_KEY = "exercise-tracker-sports";

const sportSelectBtn = document.getElementById("sport-select-btn");
const sportSelectLabel = document.getElementById("sport-select-label");
const sportSelectIcon = document.getElementById("sport-select-icon");
const sportMenuEl = document.getElementById("sport-menu");
const sportListEl = document.getElementById("sport-list");
const sportEmptyStateEl = document.getElementById("sport-empty-state");
const fitnessPanelEl = document.getElementById("fitness-panel");
const sportSortBarEl = document.getElementById("sport-sort-bar");
const sportSortSelect = document.getElementById("sport-sort-select");

const swimTemplate = document.getElementById("swim-perf-template");
const cyclingTemplate = document.getElementById("cycling-perf-template");
const runningTemplate = document.getElementById("running-perf-template");

const addSwimForm = document.getElementById("add-swim-form");
const swimStyleInput = document.getElementById("swim-style-input");
const swimDistanceSelect = document.getElementById("swim-distance-select");
const swimDistanceManualInput = document.getElementById("swim-distance-manual-input");
const swimMinutesInput = document.getElementById("swim-minutes-input");
const swimSecondsInput = document.getElementById("swim-seconds-input");
const swimHundredthsInput = document.getElementById("swim-hundredths-input");

const addCyclingForm = document.getElementById("add-cycling-form");
const cyclingLocationInput = document.getElementById("cycling-location-input");
const cyclingDistanceInput = document.getElementById("cycling-distance-input");
const cyclingHoursInput = document.getElementById("cycling-hours-input");
const cyclingMinutesInput = document.getElementById("cycling-minutes-input");
const cyclingSecondsInput = document.getElementById("cycling-seconds-input");
const cyclingHundredthsInput = document.getElementById("cycling-hundredths-input");

const addRunningForm = document.getElementById("add-running-form");
const runningDescInput = document.getElementById("running-desc-input");
const runningDistanceSelect = document.getElementById("running-distance-select");
const runningDistanceManualInput = document.getElementById("running-distance-manual-input");
const runningHoursInput = document.getElementById("running-hours-input");
const runningMinutesInput = document.getElementById("running-minutes-input");
const runningSecondsInput = document.getElementById("running-seconds-input");
const runningHundredthsInput = document.getElementById("running-hundredths-input");

const triathlonTemplate = document.getElementById("triathlon-perf-template");
const triathlonPanelEl = document.getElementById("triathlon-panel");
const triLocationInput = document.getElementById("triathlon-location-input");
const triSizeInput = document.getElementById("triathlon-size-input");
const triSteps = {
  swim: document.getElementById("triathlon-step-swim"),
  bike: document.getElementById("triathlon-step-bike"),
  run: document.getElementById("triathlon-step-run"),
};
const triFields = {
  swim: {
    hours: document.getElementById("tri-swim-hours"),
    minutes: document.getElementById("tri-swim-minutes"),
    seconds: document.getElementById("tri-swim-seconds"),
    hundredths: document.getElementById("tri-swim-hundredths"),
    validate: document.getElementById("tri-swim-validate"),
  },
  bike: {
    hours: document.getElementById("tri-bike-hours"),
    minutes: document.getElementById("tri-bike-minutes"),
    seconds: document.getElementById("tri-bike-seconds"),
    hundredths: document.getElementById("tri-bike-hundredths"),
    validate: document.getElementById("tri-bike-validate"),
  },
  run: {
    hours: document.getElementById("tri-run-hours"),
    minutes: document.getElementById("tri-run-minutes"),
    seconds: document.getElementById("tri-run-seconds"),
    hundredths: document.getElementById("tri-run-hundredths"),
    validate: document.getElementById("tri-run-validate"),
  },
};

const DISTANCE_SORT_SPORTS = ["natation", "velo", "course", "triathlon"];
const TRIATHLON_SIZE_ORDER = { XS: 0, S: 1, M: 2, L: 3, XL: 4 };

function distanceUnitFor(sport) {
  return sport === "natation" ? mUnitLabel() : kmUnitLabel();
}

function distanceToDisplay(distance, sport) {
  return sport === "natation" ? mToDisplay(distance) : kmToDisplay(distance);
}

function distanceFromDisplay(value, sport) {
  return sport === "natation" ? mFromDisplay(value) : kmFromDisplay(value);
}

// Preset options carry the canonical (km or m) value directly since they're
// fixed real-world distances (e.g. a marathon is always 42.195km); only the
// "manual" option's typed value needs converting from the display unit.
function resolveSelectDistance(dropdownEl, manualInputEl, sport) {
  const value = dropdownEl.dataset.value;
  if (value === "manual") {
    return manualInputEl.value === "" ? null : distanceFromDisplay(Number(manualInputEl.value), sport);
  }
  return Number(value);
}

function resetDistanceDropdown(dropdownEl) {
  const menu = dropdownEl.querySelector(".distance-dropdown-menu");
  const label = dropdownEl.querySelector(".distance-dropdown-label");
  const options = menu.querySelectorAll(".sport-option");
  const first = options[0];
  options.forEach((o) => o.classList.toggle("active", o === first));
  dropdownEl.dataset.value = first.dataset.value;
  label.textContent = first.textContent;
}

function bindDistanceSelect(dropdownEl, manualInputEl) {
  const btn = dropdownEl.querySelector(".distance-dropdown-btn");
  const label = dropdownEl.querySelector(".distance-dropdown-label");
  const menu = dropdownEl.querySelector(".distance-dropdown-menu");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  menu.querySelectorAll(".sport-option").forEach((option) => {
    option.addEventListener("click", () => {
      menu.querySelectorAll(".sport-option").forEach((o) => o.classList.remove("active"));
      option.classList.add("active");
      dropdownEl.dataset.value = option.dataset.value;
      label.textContent = option.textContent;
      menu.hidden = true;
      manualInputEl.hidden = option.dataset.value !== "manual";
    });
  });

  document.addEventListener("click", (e) => {
    if (!menu.hidden && !dropdownEl.contains(e.target)) menu.hidden = true;
  });

  document.addEventListener("languagechange", () => {
    const active = menu.querySelector(".sport-option.active");
    if (active) label.textContent = active.textContent;
  });
}
const ICON_CHRONO = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 13V9"/><path d="M9 3h6"/><path d="M12 3v2"/></svg>';
const ICON_RUNNING = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 17l5 1l.75 -1.5"/><path d="M15 21v-4l-4 -3l1 -6"/><path d="M7 12v-3l5 -1l3 3l3 1"/></svg>';
const ICON_SWIMMING = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><path d="M3 11c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/></svg>';
const ICON_CYCLING = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M12 19v-4l-3 -3l5 -4l2 3h3"/><path d="M13.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/></svg>';
const ICON_TRIATHLON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="4.2"/><circle cx="17" cy="8" r="4.2"/><circle cx="12" cy="15.5" r="4.2"/></svg>';
const ICON_FITNESS = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h1"/><path d="M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2"/><path d="M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1"/><path d="M9 12h6"/><path d="M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1"/><path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2"/><path d="M22 12h-1"/></svg>';
const SPORT_ICONS = { natation: ICON_SWIMMING, velo: ICON_CYCLING, course: ICON_RUNNING, triathlon: ICON_TRIATHLON };
const SPORT_SELECT_ICONS = { fitness: ICON_FITNESS, natation: ICON_SWIMMING, velo: ICON_CYCLING, course: ICON_RUNNING, triathlon: ICON_TRIATHLON };
const TEXT_PLACEHOLDER_KEYS = {
  natation: "sport.swim.stylePlaceholder",
  velo: "sport.locationPlaceholder",
  course: "sport.running.descPlaceholder",
  triathlon: "sport.locationPlaceholder",
};

function timeChipHTML(perf, sport) {
  const pad = (n) => String(n ?? 0).padStart(2, "0");
  const hoursPart =
    sport === "natation" ? "" : `<span class="chip-num">${pad(perf.hours)}</span><span class="chip-unit">h</span>`;
  return `<span class="chip-icon">${ICON_CHRONO}</span>${hoursPart}<span class="chip-num">${pad(perf.minutes)}</span><span class="chip-unit">mn</span><span class="chip-num">${pad(perf.seconds)}</span><span class="chip-unit">s</span><span class="chip-num chip-num-sub">${pad(perf.hundredths)}</span>`;
}

function distanceChipHTML(perf, sport) {
  if (perf.distance == null || perf.distance === "") return "";
  const displayValue = distanceToDisplay(perf.distance, sport);
  return `<span class="chip-icon">${SPORT_ICONS[sport]}</span><span class="chip-num">${displayValue}</span><span class="chip-unit">${distanceUnitFor(sport)}</span>`;
}

function sizeChipHTML(perf) {
  return `<span class="chip-icon">${ICON_TRIATHLON}</span><span class="chip-num">${perf.size}</span>`;
}

function legToCentiseconds(leg) {
  return ((leg?.hours ?? 0) * 3600 + (leg?.minutes ?? 0) * 60 + (leg?.seconds ?? 0)) * 100 + (leg?.hundredths ?? 0);
}

function centisecondsToHMSC(totalCenti) {
  const totalSeconds = Math.floor(totalCenti / 100);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    hundredths: totalCenti % 100,
  };
}

function triathlonTotal(perf) {
  return legToCentiseconds(perf.swim) + legToCentiseconds(perf.bike) + legToCentiseconds(perf.run);
}

function triLegRowHTML(icon, leg) {
  const pad = (n) => String(n ?? 0).padStart(2, "0");
  return `<div class="tri-popup-row"><span class="tri-popup-icon">${icon}</span><span class="tri-popup-time">${pad(leg?.hours)}H${pad(leg?.minutes)}Mn${pad(leg?.seconds)}S${pad(leg?.hundredths)}</span></div>`;
}

function perfTimeCentiseconds(perf) {
  return ((perf.hours ?? 0) * 3600 + (perf.minutes ?? 0) * 60 + (perf.seconds ?? 0)) * 100 + (perf.hundredths ?? 0);
}

let sportSortMode = "";

function getSortedSportEntries(entries, sport) {
  if (!sportSortMode) return entries;
  const sorted = [...entries];
  if (sportSortMode === "alpha-asc" || sportSortMode === "alpha-desc") {
    sorted.sort((a, b) => a.text.localeCompare(b.text, getLang()));
    if (sportSortMode === "alpha-desc") sorted.reverse();
    return sorted;
  }
  if (sportSortMode === "dist-asc" || sportSortMode === "dist-desc") {
    const keyOf = sport === "triathlon" ? (perf) => TRIATHLON_SIZE_ORDER[perf.size] ?? 0 : (perf) => perf.distance ?? 0;
    const timeOf = sport === "triathlon" ? triathlonTotal : perfTimeCentiseconds;
    sorted.sort((a, b) => {
      const distDiff = keyOf(a) - keyOf(b);
      if (distDiff !== 0) return sportSortMode === "dist-asc" ? distDiff : -distDiff;
      // Equal distance: always rank the best performance (fastest time) first.
      return timeOf(a) - timeOf(b);
    });
    return sorted;
  }
  return entries;
}

function computeBestIds(entries, sport) {
  const groupKeyOf = sport === "triathlon" ? (perf) => perf.size : (perf) => perf.distance;
  const timeOf = sport === "triathlon" ? triathlonTotal : perfTimeCentiseconds;
  const groups = new Map();
  entries.forEach((perf) => {
    const key = groupKeyOf(perf);
    if (key == null || key === "") return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(perf);
  });
  const bestIds = new Set();
  groups.forEach((group) => {
    let best = group[0];
    group.forEach((perf) => {
      if (timeOf(perf) < timeOf(best)) best = perf;
    });
    bestIds.add(best.id);
  });
  return bestIds;
}

const SPORT_FORMS = { natation: addSwimForm, velo: addCyclingForm, course: addRunningForm };
const SPORT_TEMPLATES = { natation: swimTemplate, velo: cyclingTemplate, course: runningTemplate, triathlon: triathlonTemplate };
const SPORT_LABEL_KEYS = { fitness: "sport.fitness", natation: "sport.swimming", velo: "sport.cycling", course: "sport.running", triathlon: "sport.triathlon" };

let currentSport = "fitness";
let sportPerfs = loadSportPerfs();

function loadSportPerfs() {
  try {
    const raw = localStorage.getItem(SPORTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      natation: parsed.natation || [],
      velo: parsed.velo || [],
      course: parsed.course || [],
      triathlon: parsed.triathlon || [],
    };
  } catch {
    return { natation: [], velo: [], course: [], triathlon: [] };
  }
}

function saveSportPerfs() {
  localStorage.setItem(SPORTS_STORAGE_KEY, JSON.stringify(sportPerfs));
  window.syncLeaderboardEntries && window.syncLeaderboardEntries(sportPerfs);
}

function updateSportSelectLabel() {
  sportSelectLabel.textContent = t(SPORT_LABEL_KEYS[currentSport]);
  sportSelectIcon.innerHTML = SPORT_SELECT_ICONS[currentSport] || "";
}

function sortSportMenu() {
  const buttons = Array.from(sportMenuEl.querySelectorAll(".sport-option"));
  buttons.sort((a, b) => {
    const textA = t(SPORT_LABEL_KEYS[a.dataset.sport]);
    const textB = t(SPORT_LABEL_KEYS[b.dataset.sport]);
    return textA.localeCompare(textB, getLang());
  });
  buttons.forEach((btn) => sportMenuEl.appendChild(btn));
}

function selectSport(sport) {
  currentSport = sport;
  sportMenuEl.querySelectorAll(".sport-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sport === sport);
  });
  fitnessPanelEl.hidden = sport !== "fitness";
  triathlonPanelEl.hidden = sport !== "triathlon";
  if (sport === "triathlon") resetTriathlonWizard();
  Object.keys(SPORT_FORMS).forEach((key) => {
    SPORT_FORMS[key].hidden = key !== sport;
  });
  sportSortBarEl.hidden = sport === "fitness";
  const canSortByDistance = DISTANCE_SORT_SPORTS.includes(sport);
  sportSortSelect.querySelectorAll(".sort-opt-dist").forEach((opt) => {
    opt.hidden = !canSortByDistance;
  });
  sportSortMode = "";
  sportSortSelect.value = "";
  updateSportSelectLabel();
  renderSportList();
}

sportSelectBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  sportMenuEl.hidden = !sportMenuEl.hidden;
});

sportMenuEl.querySelectorAll(".sport-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectSport(btn.dataset.sport);
    sportMenuEl.hidden = true;
  });
});

document.addEventListener("click", (e) => {
  if (!sportMenuEl.hidden && !sportMenuEl.contains(e.target) && e.target !== sportSelectBtn) {
    sportMenuEl.hidden = true;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !sportMenuEl.hidden) sportMenuEl.hidden = true;
});

sportSortSelect.addEventListener("change", () => {
  sportSortMode = sportSortSelect.value;
  renderSportList();
});

function renderSportList() {
  if (currentSport === "fitness") {
    sportListEl.innerHTML = "";
    sportEmptyStateEl.classList.remove("visible");
    return;
  }

  sportListEl.innerHTML = "";
  const entries = getSortedSportEntries(sportPerfs[currentSport], currentSport);
  sportEmptyStateEl.classList.toggle("visible", entries.length === 0);

  const template = SPORT_TEMPLATES[currentSport];
  const bestIds = computeBestIds(entries, currentSport);

  entries.forEach((perf) => {
    const node = template.content.cloneNode(true);

    const textInput = node.querySelector(".perf-text");
    if (textInput) {
      textInput.value = perf.text;
      textInput.placeholder = t(TEXT_PLACEHOLDER_KEYS[currentSport]);

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

      const rowMenuEditBtn = node.querySelector(".row-menu-edit");
      rowMenuEditBtn.textContent = t("edit.title");
      rowMenuEditBtn.addEventListener("click", () => {
        closeAllRowMenus();
        textInput.readOnly = false;
        textInput.focus();
        textInput.select();
      });
    }

    const distanceDisplay = node.querySelector(".perf-distance-display");
    if (distanceDisplay) {
      const html = distanceChipHTML(perf, currentSport);
      distanceDisplay.innerHTML = html;
      distanceDisplay.hidden = !html;
    }

    const sizeDisplay = node.querySelector(".perf-size-display");
    if (sizeDisplay) sizeDisplay.innerHTML = sizeChipHTML(perf);

    const bestBadge = node.querySelector(".perf-best-badge");
    if (bestBadge) {
      const isBest = bestIds.has(perf.id);
      bestBadge.hidden = !isBest;
      if (isBest) bestBadge.title = t("sport.bestPerfTitle");
    }

    const timeDisplay = node.querySelector(".perf-time-display");
    if (currentSport === "triathlon") {
      timeDisplay.innerHTML = timeChipHTML(centisecondsToHMSC(triathlonTotal(perf)), "velo");
      timeDisplay.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleTriPopup(timeDisplay, perf);
      });
    } else {
      timeDisplay.innerHTML = timeChipHTML(perf, currentSport);
    }

    const rowMenuBtn = node.querySelector(".row-menu-btn");
    const rowMenuDropdown = node.querySelector(".row-menu-dropdown");
    rowMenuBtn.title = t("rowMenu.title");
    rowMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleRowMenu(rowMenuDropdown);
    });

    const rowMenuDeleteBtn = node.querySelector(".row-menu-delete");
    rowMenuDeleteBtn.textContent = t("delete.title");
    rowMenuDeleteBtn.addEventListener("click", () => {
      closeAllRowMenus();
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
    distance: resolveSelectDistance(swimDistanceSelect, swimDistanceManualInput, "natation"),
    minutes: swimMinutesInput.value === "" ? null : Number(swimMinutesInput.value),
    seconds: swimSecondsInput.value === "" ? null : Number(swimSecondsInput.value),
    hundredths: swimHundredthsInput.value === "" ? null : Number(swimHundredthsInput.value),
  });
  saveSportPerfs();
  renderSportList();
  addSwimForm.reset();
  resetDistanceDropdown(swimDistanceSelect);
  swimDistanceManualInput.hidden = true;
  swimStyleInput.focus();
});

addCyclingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = cyclingLocationInput.value.trim();
  if (!text || cyclingDistanceInput.value === "") return;
  sportPerfs.velo.push({
    id: crypto.randomUUID(),
    text,
    distance: distanceFromDisplay(Number(cyclingDistanceInput.value), "velo"),
    hours: cyclingHoursInput.value === "" ? null : Number(cyclingHoursInput.value),
    minutes: cyclingMinutesInput.value === "" ? null : Number(cyclingMinutesInput.value),
    seconds: cyclingSecondsInput.value === "" ? null : Number(cyclingSecondsInput.value),
    hundredths: cyclingHundredthsInput.value === "" ? null : Number(cyclingHundredthsInput.value),
  });
  saveSportPerfs();
  renderSportList();
  addCyclingForm.reset();
  cyclingLocationInput.focus();
});

addRunningForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = runningDescInput.value.trim();
  if (!text) return;
  sportPerfs.course.push({
    id: crypto.randomUUID(),
    text,
    distance: resolveSelectDistance(runningDistanceSelect, runningDistanceManualInput, "course"),
    hours: runningHoursInput.value === "" ? null : Number(runningHoursInput.value),
    minutes: runningMinutesInput.value === "" ? null : Number(runningMinutesInput.value),
    seconds: runningSecondsInput.value === "" ? null : Number(runningSecondsInput.value),
    hundredths: runningHundredthsInput.value === "" ? null : Number(runningHundredthsInput.value),
  });
  saveSportPerfs();
  renderSportList();
  addRunningForm.reset();
  resetDistanceDropdown(runningDistanceSelect);
  runningDistanceManualInput.hidden = true;
  runningDescInput.focus();
});

// ---- Triathlon step wizard ----
let triathlonDraft = { swim: null, bike: null, run: null };

function resetTriathlonWizard() {
  triLocationInput.value = "";
  triSizeInput.value = "M";
  Object.values(triFields).forEach(({ hours, minutes, seconds, hundredths }) => {
    hours.value = "";
    minutes.value = "";
    seconds.value = "";
    hundredths.value = "";
  });
  triSteps.swim.hidden = false;
  triSteps.bike.hidden = true;
  triSteps.run.hidden = true;
  triathlonDraft = { swim: null, bike: null, run: null };
}

function readTriLeg(leg) {
  const { hours, minutes, seconds, hundredths } = triFields[leg];
  return {
    hours: hours.value === "" ? 0 : Number(hours.value),
    minutes: minutes.value === "" ? 0 : Number(minutes.value),
    seconds: seconds.value === "" ? 0 : Number(seconds.value),
    hundredths: hundredths.value === "" ? 0 : Number(hundredths.value),
  };
}

triFields.swim.validate.addEventListener("click", () => {
  triathlonDraft.swim = readTriLeg("swim");
  triSteps.swim.hidden = true;
  triSteps.bike.hidden = false;
});

triFields.bike.validate.addEventListener("click", () => {
  triathlonDraft.bike = readTriLeg("bike");
  triSteps.bike.hidden = true;
  triSteps.run.hidden = false;
});

triFields.run.validate.addEventListener("click", () => {
  const text = triLocationInput.value.trim();
  if (!text) {
    triLocationInput.focus();
    return;
  }
  triathlonDraft.run = readTriLeg("run");
  sportPerfs.triathlon.push({
    id: crypto.randomUUID(),
    text,
    size: triSizeInput.value,
    swim: triathlonDraft.swim,
    bike: triathlonDraft.bike,
    run: triathlonDraft.run,
  });
  saveSportPerfs();
  renderSportList();
  resetTriathlonWizard();
});

// ---- Triathlon breakdown popup ----
let openTriPopup = null;

function closeTriPopup() {
  if (openTriPopup) {
    openTriPopup.remove();
    openTriPopup = null;
  }
}

function toggleTriPopup(anchorEl, perf) {
  if (openTriPopup) {
    closeTriPopup();
    return;
  }
  const popup = document.createElement("div");
  popup.className = "tri-popup";
  popup.innerHTML =
    triLegRowHTML(ICON_SWIMMING, perf.swim) + triLegRowHTML(ICON_CYCLING, perf.bike) + triLegRowHTML(ICON_RUNNING, perf.run);
  document.body.appendChild(popup);

  const rect = anchorEl.getBoundingClientRect();
  const popupWidth = popup.offsetWidth;
  popup.style.position = "fixed";
  popup.style.top = `${rect.bottom + 6}px`;
  popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - popupWidth - 8))}px`;
  openTriPopup = popup;
}

document.addEventListener("click", (e) => {
  if (openTriPopup && !openTriPopup.contains(e.target)) closeTriPopup();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openTriPopup) closeTriPopup();
});

function updateDistancePlaceholders() {
  const distanceLabel = t("field.distance");
  swimDistanceManualInput.placeholder = `${distanceLabel} (${mUnitLabel()})`;
  cyclingDistanceInput.placeholder = `${distanceLabel} (${kmUnitLabel()})`;
  runningDistanceManualInput.placeholder = `${distanceLabel} (${kmUnitLabel()})`;
}

document.addEventListener("languagechange", () => {
  sortSportMenu();
  updateSportSelectLabel();
  updateDistancePlaceholders();
  renderSportList();
});

document.addEventListener("unitschange", () => {
  updateDistancePlaceholders();
  renderSportList();
});

bindDistanceSelect(swimDistanceSelect, swimDistanceManualInput);
bindDistanceSelect(runningDistanceSelect, runningDistanceManualInput);

sortSportMenu();
updateDistancePlaceholders();
selectSport("fitness");
