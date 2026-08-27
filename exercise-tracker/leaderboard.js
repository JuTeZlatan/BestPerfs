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
const LEADERBOARD_SPORTS = ["course", "natation", "triathlon"];
const PRESET_KEYS = {
  course: ["0.8", "1.5", "3", "5", "10", "half", "marathon"],
  natation: ["50", "100", "200", "400", "800", "1500"],
  triathlon: ["XS", "S", "M", "L", "XL"],
};
const RUNNING_DISTANCE_TO_KEY = {
  "0.8": "0.8",
  "1.5": "1.5",
  "3": "3",
  "5": "5",
  "10": "10",
  "21.0975": "half",
  "42.195": "marathon",
};

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
    const key = String(perf.distance);
    return PRESET_KEYS.natation.includes(key) ? key : null;
  }
  return RUNNING_DISTANCE_TO_KEY[String(perf.distance)] || null;
}

function myUsername() {
  const el = document.getElementById("account-username-display");
  return el ? el.textContent.trim() : "";
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
    entries.forEach((perf) => {
      const key = presetKeyForEntry(sport, perf);
      if (!key) return;
      const seconds = sport === "triathlon" ? triathlonSeconds(perf) : perfSeconds(perf);
      if (!(key in bestBySeconds) || seconds < bestBySeconds[key]) bestBySeconds[key] = seconds;
    });

    PRESET_KEYS[sport].forEach((presetKey) => {
      const ref = doc(db, "leaderboardEntries", `${uid}_${sport}_${presetKey}`);
      if (presetKey in bestBySeconds) {
        setDoc(ref, {
          uid,
          username,
          sport,
          presetKey,
          totalSeconds: bestBySeconds[presetKey],
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } else {
        deleteDoc(ref).catch(() => {});
      }
    });
  });
}
window.syncLeaderboardEntries = syncLeaderboardEntries;

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
};
const classementRowTemplate = document.getElementById("classement-row-template");

const CLASSEMENT_SPORT_LABEL_KEYS = { course: "sport.running", natation: "sport.swimming", triathlon: "sport.triathlon" };
const CLASSEMENT_SPORT_ICONS = {
  course: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 17l5 1l.75 -1.5"/><path d="M15 21v-4l-4 -3l1 -6"/><path d="M7 12v-3l5 -1l3 3l3 1"/></svg>',
  natation: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><path d="M3 11c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/></svg>',
  triathlon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="8" r="4.2"/><circle cx="17" cy="8" r="4.2"/><circle cx="12" cy="15.5" r="4.2"/></svg>',
};

let classementSport = "course";
let classementPreset = null;

function updateClassementSportLabel() {
  classementSportLabel.textContent = t(CLASSEMENT_SPORT_LABEL_KEYS[classementSport]);
  classementSportIcon.innerHTML = CLASSEMENT_SPORT_ICONS[classementSport] || "";
}

function resetPresetDropdown(dropdown) {
  const label = dropdown.querySelector(".classement-preset-label");
  label.textContent = t("classement.choosePreset");
  label.dataset.i18n = "classement.choosePreset";
  dropdown.querySelectorAll(".sport-option").forEach((btn) => btn.classList.remove("active"));
  dropdown.querySelector(".classement-preset-menu").hidden = true;
}

function selectClassementSport(sport) {
  classementSport = sport;
  classementPreset = null;
  classementSportMenu.querySelectorAll(".sport-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sport === sport);
  });
  Object.keys(classementPresetSelects).forEach((key) => {
    classementPresetSelects[key].hidden = key !== sport;
    resetPresetDropdown(classementPresetSelects[key]);
  });
  updateClassementSportLabel();
  renderClassementList();
}

classementSportBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  classementSportMenu.hidden = !classementSportMenu.hidden;
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
  Object.values(classementPresetSelects).forEach((dropdown) => {
    const menu = dropdown.querySelector(".classement-preset-menu");
    if (!menu.hidden && !dropdown.contains(e.target)) menu.hidden = true;
  });
});

Object.values(classementPresetSelects).forEach((dropdown) => {
  const btn = dropdown.querySelector(".classement-preset-btn");
  const menu = dropdown.querySelector(".classement-preset-menu");
  const label = dropdown.querySelector(".classement-preset-label");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  menu.querySelectorAll(".sport-option").forEach((option) => {
    option.addEventListener("click", () => {
      menu.querySelectorAll(".sport-option").forEach((o) => o.classList.remove("active"));
      option.classList.add("active");
      delete label.dataset.i18n;
      label.textContent = option.textContent;
      menu.hidden = true;
      classementPreset = option.dataset.value || null;
      renderClassementList();
    });
  });
});

function formatSeconds(totalSeconds) {
  const centis = Math.round(totalSeconds * 100);
  const h = Math.floor(centis / 360000);
  const m = Math.floor((centis % 360000) / 6000);
  const s = Math.floor((centis % 6000) / 100);
  const cs = centis % 100;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}h${pad(m)}mn${pad(s)}s${pad(cs)}` : `${pad(m)}mn${pad(s)}s${pad(cs)}`;
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
    .sort((a, b) => a.totalSeconds - b.totalSeconds);

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
    node.querySelector(".classement-time").textContent = formatSeconds(row.totalSeconds);
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
