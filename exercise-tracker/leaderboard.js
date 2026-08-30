import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "./firebase-init.js";

// ---- Preset definitions (mirror the existing add-form preset dropdowns in
// sports.js/index.html) - only these are comparable across users. ----
const LEADERBOARD_SPORTS = ["course", "natation", "triathlon", "velo"];
const VELO_BRACKETS = [
  [0, 10], [10, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 100],
  [100, 150], [150, 200], [200, 300],
];
const NATATION_DISTANCES = ["50", "100", "200", "400", "800", "1500", "5000", "10000"];
const SWIM_STROKES = ["freestyle", "backstroke", "breaststroke", "butterfly", "medley"];
const PRESET_KEYS = {
  course: ["0.1", "0.2", "0.4", "0.8", "1.5", "3", "5", "10", "half", "marathon"],
  // Natation is ranked per distance+style (a 100m freestyle isn't comparable
  // to a 100m breaststroke), so each preset key combines both.
  natation: NATATION_DISTANCES.flatMap((distance) => SWIM_STROKES.map((stroke) => `${distance}-${stroke}`)),
  triathlon: ["XS", "S", "M", "L", "XL"],
  velo: VELO_BRACKETS.map(([lo, hi]) => `${lo}-${hi}`),
  fitness: ["pushups", "situps", "pullups", "dips", "benchpress", "curls", "squats"],
};
// Fitness ranks the opposite way from every other sport here: more reps or
// more weight is better, not a lower time.
const FITNESS_METRIC = {
  pushups: "reps",
  situps: "reps",
  pullups: "reps",
  dips: "reps",
  benchpress: "weight",
  curls: "weight",
  squats: "reps",
};
const RUNNING_DISTANCE_TO_KEY = {
  "0.1": "0.1",
  "0.2": "0.2",
  "0.4": "0.4",
  "0.8": "0.8",
  "1.5": "1.5",
  "3": "3",
  "5": "5",
  "10": "10",
  "21.0975": "half",
  "42.195": "marathon",
};

function veloBracketKey(distanceKm) {
  if (distanceKm == null) return null;
  const bracket = VELO_BRACKETS.find(([lo, hi]) => distanceKm <= hi && (lo === 0 ? distanceKm >= 0 : distanceKm > lo));
  return bracket ? `${bracket[0]}-${bracket[1]}` : null;
}

function perfSeconds(perf) {
  return (perf.hours ?? 0) * 3600 + (perf.minutes ?? 0) * 60 + (perf.seconds ?? 0) + (perf.hundredths ?? 0) / 100;
}

function triathlonSeconds(perf) {
  const legSeconds = (leg) =>
    (leg?.hours ?? 0) * 3600 + (leg?.minutes ?? 0) * 60 + (leg?.seconds ?? 0) + (leg?.hundredths ?? 0) / 100;
  return legSeconds(perf.swim) + legSeconds(perf.bike) + legSeconds(perf.run);
}

function presetKeyForEntry(sport, perf) {
  if (sport === "triathlon") return PRESET_KEYS.triathlon.includes(perf.size) ? perf.size : null;
  if (sport === "natation") {
    const distance = String(perf.distance);
    if (!NATATION_DISTANCES.includes(distance) || !SWIM_STROKES.includes(perf.text)) return null;
    return `${distance}-${perf.text}`;
  }
  if (sport === "velo") return veloBracketKey(perf.distance);
  return RUNNING_DISTANCE_TO_KEY[String(perf.distance)] || null;
}

function myUsername() {
  const el = document.getElementById("account-username-display");
  return el ? el.textContent.trim() : "";
}

// Only publish photo URLs to a shared leaderboard entry when the photos were
// actually uploaded to the cloud (a purely local photo can't be fetched by a
// friend) and the user hasn't opted out of sharing proofs.
function sharedPhotoUrls(perf) {
  if (!perf || !perf.photos || !perf.photos.length) return null;
  if (typeof window.getPhotoStorageMode !== "function" || window.getPhotoStorageMode() !== "cloud") return null;
  if (typeof window.getShareProofs !== "function" || !window.getShareProofs()) return null;
  const urls = perf.photos.filter((p) => p.mode === "cloud" && p.url).map((p) => p.url);
  return urls.length ? urls : null;
}

// ---- Sync local bests to Firestore: one doc per sport+preset holding the
// current best time only, called from sports.js's saveSportPerfs(). ----
async function syncLeaderboardEntries(sportPerfs) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const username = myUsername();
  if (!username) return;

  LEADERBOARD_SPORTS.forEach((sport) => {
    const entries = sportPerfs[sport] || [];
    const bestBySeconds = {};
    const bestPerfByKey = {};
    entries.forEach((perf) => {
      const key = presetKeyForEntry(sport, perf);
      if (!key) return;
      const seconds = sport === "triathlon" ? triathlonSeconds(perf) : perfSeconds(perf);
      if (!(key in bestBySeconds) || seconds < bestBySeconds[key]) {
        bestBySeconds[key] = seconds;
        bestPerfByKey[key] = perf;
      }
    });

    PRESET_KEYS[sport].forEach((presetKey) => {
      const ref = doc(db, "leaderboardEntries", `${uid}_${sport}_${presetKey}`);
      if (presetKey in bestBySeconds) {
        const payload = {
          uid,
          username,
          sport,
          presetKey,
          totalSeconds: bestBySeconds[presetKey],
          updatedAt: serverTimestamp(),
        };
        const photoUrls = sharedPhotoUrls(bestPerfByKey[presetKey]);
        if (photoUrls) payload.photoUrls = photoUrls;
        setDoc(ref, payload).catch(() => {});
      } else {
        deleteDoc(ref).catch(() => {});
      }
    });
  });
}
window.syncLeaderboardEntries = syncLeaderboardEntries;

// ---- Sync Fitness preset-exercise bests to Firestore, called from
// script.js's saveExercises(). Manual (non-preset) exercises aren't
// comparable across users, so they're skipped. ----
async function syncFitnessLeaderboardEntries(exercises) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const username = myUsername();
  if (!username) return;

  const bestByKey = {};
  const bestExerciseByKey = {};
  exercises.forEach((exercise) => {
    const key = exercise.exerciseKey;
    if (!key || !PRESET_KEYS.fitness.includes(key)) return;
    const metric = FITNESS_METRIC[key];
    const value = metric === "reps" ? exercise.maxReps : exercise.maxWeight;
    if (value == null) return;
    if (!(key in bestByKey) || value > bestByKey[key]) {
      bestByKey[key] = value;
      bestExerciseByKey[key] = exercise;
    }
  });

  PRESET_KEYS.fitness.forEach((presetKey) => {
    const ref = doc(db, "leaderboardEntries", `${uid}_fitness_${presetKey}`);
    if (presetKey in bestByKey) {
      const payload = {
        uid,
        username,
        sport: "fitness",
        presetKey,
        totalSeconds: bestByKey[presetKey],
        updatedAt: serverTimestamp(),
      };
      const photoUrls = sharedPhotoUrls(bestExerciseByKey[presetKey]);
      if (photoUrls) payload.photoUrls = photoUrls;
      setDoc(ref, payload).catch(() => {});
    } else {
      deleteDoc(ref).catch(() => {});
    }
  });
}
window.syncFitnessLeaderboardEntries = syncFitnessLeaderboardEntries;

// ---- UI: sport/preset pickers + ranking ----
const classementSportBtn = document.getElementById("classement-sport-select-btn");
const classementSportLabel = document.getElementById("classement-sport-select-label");
const classementSportIcon = document.getElementById("classement-sport-select-icon");
const classementSportMenu = document.getElementById("classement-sport-menu");
const classementListEl = document.getElementById("classement-list");
const classementEmptyEl = document.getElementById("classement-empty-state");
const classementPresetSelects = {
  course: document.getElementById("classement-preset-course"),
  natation: document.getElementById("classement-preset-natation"),
  triathlon: document.getElementById("classement-preset-triathlon"),
  velo: document.getElementById("classement-preset-velo"),
  fitness: document.getElementById("classement-preset-fitness"),
};
const classementNatationStrokeSelect = document.getElementById("classement-preset-natation-stroke");
const classementRowTemplate = document.getElementById("classement-row-template");

const CLASSEMENT_SPORT_LABEL_KEYS = { course: "sport.running", natation: "sport.swimming", triathlon: "sport.triathlon", velo: "sport.cycling", fitness: "sport.fitness" };
const CLASSEMENT_SPORT_ICONS = {
  course: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 17l5 1l.75 -1.5"/><path d="M15 21v-4l-4 -3l1 -6"/><path d="M7 12v-3l5 -1l3 3l3 1"/></svg>',
  natation: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><path d="M3 11c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/></svg>',
  triathlon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="4.2"/><circle cx="17" cy="8" r="4.2"/><circle cx="12" cy="15.5" r="4.2"/></svg>',
  velo: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M12 19v-4l-3 -3l5 -4l2 3h3"/><path d="M13.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/></svg>',
  fitness: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h1"/><path d="M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2"/><path d="M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1"/><path d="M9 12h6"/><path d="M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1"/><path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2"/><path d="M22 12h-1"/></svg>',
};

let classementSport = "course";
let classementPreset = null;
// Natation is the only sport ranked by two combined pickers (distance +
// swim style) instead of one, so its final presetKey is only known once
// both are chosen.
let classementNatationDistance = null;
let classementNatationStroke = null;

function updateClassementSportLabel() {
  classementSportLabel.textContent = t(CLASSEMENT_SPORT_LABEL_KEYS[classementSport]);
  classementSportIcon.innerHTML = CLASSEMENT_SPORT_ICONS[classementSport] || "";
}

function resetPresetDropdown(dropdown) {
  const label = dropdown.querySelector(".classement-preset-label");
  const defaultKey = label.dataset.defaultI18n || "classement.choosePreset";
  label.textContent = t(defaultKey);
  label.dataset.i18n = defaultKey;
  dropdown.querySelectorAll(".sport-option").forEach((btn) => btn.classList.remove("active"));
  dropdown.querySelector(".classement-preset-menu").hidden = true;
}

function selectClassementSport(sport) {
  classementSport = sport;
  classementPreset = null;
  classementNatationDistance = null;
  classementNatationStroke = null;
  classementSportMenu.querySelectorAll(".sport-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sport === sport);
  });
  Object.keys(classementPresetSelects).forEach((key) => {
    classementPresetSelects[key].hidden = key !== sport;
    resetPresetDropdown(classementPresetSelects[key]);
  });
  classementNatationStrokeSelect.hidden = sport !== "natation";
  resetPresetDropdown(classementNatationStrokeSelect);
  updateClassementSportLabel();
  renderClassementList();
}

classementSportBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const opening = classementSportMenu.hidden;
  window.closeAllDropdowns();
  classementSportMenu.hidden = !opening;
});

classementSportMenu.querySelectorAll(".sport-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectClassementSport(btn.dataset.sport);
    classementSportMenu.hidden = true;
  });
});

document.addEventListener("click", (e) => {
  if (!classementSportMenu.hidden && !classementSportMenu.contains(e.target) && e.target !== classementSportBtn) {
    classementSportMenu.hidden = true;
  }
  [...Object.values(classementPresetSelects), classementNatationStrokeSelect].forEach((dropdown) => {
    const menu = dropdown.querySelector(".classement-preset-menu");
    if (!menu.hidden && !dropdown.contains(e.target)) menu.hidden = true;
  });
});

function updateClassementNatationPreset() {
  classementPreset =
    classementNatationDistance && classementNatationStroke ? `${classementNatationDistance}-${classementNatationStroke}` : null;
  renderClassementList();
}

function bindPresetDropdown(dropdown, onSelect) {
  const btn = dropdown.querySelector(".classement-preset-btn");
  const menu = dropdown.querySelector(".classement-preset-menu");
  const label = dropdown.querySelector(".classement-preset-label");
  label.dataset.defaultI18n = label.dataset.i18n;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = menu.hidden;
    window.closeAllDropdowns();
    menu.hidden = !opening;
  });

  menu.querySelectorAll(".sport-option").forEach((option) => {
    option.addEventListener("click", () => {
      menu.querySelectorAll(".sport-option").forEach((o) => o.classList.remove("active"));
      option.classList.add("active");
      delete label.dataset.i18n;
      label.textContent = option.textContent;
      menu.hidden = true;
      onSelect(option.dataset.value || null);
    });
  });
}

Object.entries(classementPresetSelects).forEach(([sport, dropdown]) => {
  if (sport === "natation") {
    bindPresetDropdown(dropdown, (value) => {
      classementNatationDistance = value;
      updateClassementNatationPreset();
    });
  } else {
    bindPresetDropdown(dropdown, (value) => {
      classementPreset = value;
      renderClassementList();
    });
  }
});

bindPresetDropdown(classementNatationStrokeSelect, (value) => {
  classementNatationStroke = value;
  updateClassementNatationPreset();
});

function formatFitnessValue(value, presetKey) {
  if (FITNESS_METRIC[presetKey] === "weight") {
    return `${window.weightToDisplay(value)} ${window.weightUnitLabel()}`;
  }
  return `${value} ${t("field.reps")}`;
}

function formatSeconds(totalSeconds) {
  const centis = Math.round(totalSeconds * 100);
  const h = Math.floor(centis / 360000);
  const m = Math.floor((centis % 360000) / 6000);
  const s = Math.floor((centis % 6000) / 100);
  const cs = centis % 100;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}h${pad(m)}mn${pad(s)}s${pad(cs)}` : `${pad(m)}mn${pad(s)}s${pad(cs)}`;
}

function toggleClassementInfoPopup(anchorEl, row) {
  anchorEl.dataset.popupId = anchorEl.dataset.popupId || `classement-info-${row.uid}-${row.presetKey}`;
  const label =
    row.updatedAt && typeof row.updatedAt.toDate === "function"
      ? row.updatedAt.toDate().toLocaleDateString(getLang(), { day: "numeric", month: "long", year: "numeric" })
      : t("sport.dateUnknown");
  window.showFloatingPopup &&
    window.showFloatingPopup(anchorEl, `<div class="tri-popup-row"><span class="tri-popup-time">${label}</span></div>`);
}

async function renderClassementList() {
  classementListEl.innerHTML = "";
  classementEmptyEl.classList.remove("visible");
  const myUid = auth.currentUser?.uid;
  if (!myUid || !classementPreset) return;

  const requestsRef = collection(db, "friendRequests");
  const [asFromSnap, asToSnap] = await Promise.all([
    getDocs(query(requestsRef, where("fromUid", "==", myUid), where("status", "==", "accepted"))),
    getDocs(query(requestsRef, where("toUid", "==", myUid), where("status", "==", "accepted"))),
  ]).catch((error) => {
    console.error(error);
    return [];
  });

  const friendUids = [
    ...(asFromSnap ? asFromSnap.docs.map((d) => d.data().toUid) : []),
    ...(asToSnap ? asToSnap.docs.map((d) => d.data().fromUid) : []),
  ];
  const uids = [myUid, ...friendUids];

  const snaps = await Promise.all(
    uids.map((uid) => getDoc(doc(db, "leaderboardEntries", `${uid}_${classementSport}_${classementPreset}`)).catch(() => null))
  );

  const rows = snaps
    .filter((snap) => snap && snap.exists())
    .map((snap) => snap.data())
    .sort((a, b) => (classementSport === "fitness" ? b.totalSeconds - a.totalSeconds : a.totalSeconds - b.totalSeconds));

  classementEmptyEl.classList.toggle("visible", rows.length === 0);

  rows.forEach((row, index) => {
    const node = classementRowTemplate.content.cloneNode(true);
    const card = node.querySelector(".exercise-card");
    const rankEl = node.querySelector(".classement-rank");
    rankEl.textContent = String(index + 1);
    rankEl.classList.toggle("rank-gold", index === 0);
    rankEl.classList.toggle("rank-silver", index === 1);
    rankEl.classList.toggle("rank-bronze", index === 2);
    const nameEl = node.querySelector(".classement-name");
    nameEl.textContent = row.uid === myUid ? `${row.username} ${t("classement.you")}` : row.username;
    if (row.uid === myUid) card.classList.add("classement-row-you");
    node.querySelector(".classement-time").textContent =
      row.sport === "fitness" ? formatFitnessValue(row.totalSeconds, row.presetKey) : formatSeconds(row.totalSeconds);
    const timeDisplay = node.querySelector(".perf-time-display");
    if (timeDisplay) {
      timeDisplay.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleClassementInfoPopup(timeDisplay, row);
      });
    }
    const proofBtn = node.querySelector(".perf-proof-btn");
    if (proofBtn) {
      proofBtn.hidden = !(row.photoUrls && row.photoUrls.length);
      proofBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.openProofViewer && window.openProofViewer(row.photoUrls);
      });
    }
    classementListEl.appendChild(node);
  });
}

document.getElementById("classement-icon-btn").addEventListener("click", () => {
  window.showView("classement");
  selectClassementSport(classementSport);
});

document.addEventListener("languagechange", () => {
  updateClassementSportLabel();
  const activeDropdown = classementPresetSelects[classementSport];
  const activeOption = activeDropdown?.querySelector(".sport-option.active");
  if (activeOption) activeDropdown.querySelector(".classement-preset-label").textContent = activeOption.textContent;
  if (!document.getElementById("classement-view").hidden) renderClassementList();
});

updateClassementSportLabel();
