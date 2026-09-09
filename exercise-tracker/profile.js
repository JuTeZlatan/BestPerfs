import { auth, db, doc, getDoc, collection, query, where, getDocs } from "./firebase-init.js";

const profileViewForSupport = document.getElementById("profile-view");
const profileSupportRow = document.getElementById("profile-support-row");
const supportViewEl = document.getElementById("support-view");
const supportBackBtn = document.getElementById("support-back-btn");

profileSupportRow.addEventListener("click", () => {
  profileViewForSupport.hidden = true;
  supportViewEl.hidden = false;
});

supportBackBtn.addEventListener("click", () => {
  supportViewEl.hidden = true;
  profileViewForSupport.hidden = false;
});

// ---- Statistics ----
const profileStatisticsRow = document.getElementById("profile-statistics-row");
const statisticsViewEl = document.getElementById("statistics-view");
const statisticsBackBtn = document.getElementById("statistics-back-btn");
const statisticsGeneralContent = document.getElementById("statistics-general-content");
const statisticsSportContent = document.getElementById("statistics-sport-content");
const statTotalCountEl = document.getElementById("stat-total-count");
const statChallengesWonEl = document.getElementById("stat-challenges-won");
const statAvgRankEl = document.getElementById("stat-avg-rank");
const statFirstPlacesEl = document.getElementById("stat-first-places");
const statFriendCountEl = document.getElementById("stat-friend-count");
const statStreakEl = document.getElementById("stat-streak");

profileStatisticsRow.addEventListener("click", () => {
  profileViewForSupport.hidden = true;
  statisticsViewEl.hidden = false;
  refreshCurrentStats();
});

statisticsBackBtn.addEventListener("click", () => {
  statisticsViewEl.hidden = true;
  profileViewForSupport.hidden = false;
});

// ---- Statistics filter dropdown: Général plus every tracked sport, each
// with its own set of icon tiles. ----
const statisticsSelectBtn = document.getElementById("statistics-select-btn");
const statisticsSelectLabel = document.getElementById("statistics-select-label");
const statisticsSelectIcon = document.getElementById("statistics-select-icon");
const statisticsMenuEl = document.getElementById("statistics-menu");
let currentStatFilter = "general";

function selectStatFilter(option) {
  currentStatFilter = option.dataset.stat;
  statisticsMenuEl.querySelectorAll(".sport-option").forEach((btn) => btn.classList.toggle("active", btn === option));
  statisticsSelectLabel.textContent = option.querySelector("span:last-child").textContent;
  statisticsSelectIcon.innerHTML = option.querySelector(".view-icon").innerHTML;
  statisticsGeneralContent.hidden = currentStatFilter !== "general";
  statisticsSportContent.hidden = currentStatFilter === "general";
  if (!statisticsViewEl.hidden) refreshCurrentStats();
}

function refreshCurrentStats() {
  if (currentStatFilter === "general") refreshGeneralStats();
  else renderSportStats(currentStatFilter);
}

statisticsSelectBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const opening = statisticsMenuEl.hidden;
  window.closeAllDropdowns();
  statisticsMenuEl.hidden = !opening;
});

statisticsMenuEl.querySelectorAll(".sport-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectStatFilter(btn);
    statisticsMenuEl.hidden = true;
  });
});

document.addEventListener("click", (e) => {
  if (!statisticsMenuEl.hidden && !statisticsMenuEl.contains(e.target) && e.target !== statisticsSelectBtn) {
    statisticsMenuEl.hidden = true;
  }
});

document.addEventListener("languagechange", () => {
  const active = statisticsMenuEl.querySelector(".sport-option.active");
  if (active) statisticsSelectLabel.textContent = active.querySelector("span:last-child").textContent;
  if (!statisticsViewEl.hidden && currentStatFilter !== "general") renderSportStats(currentStatFilter);
});

// ---- Général stats: pools rankings from Classement (friends leaderboard)
// and Défis together. A ranking only counts once at least 3 friends (or
// other participants) are actually present, so a near-empty category
// doesn't skew the average or count as a cheap "1st place". ----
const MIN_RIVALS_FOR_RANKING = 3;

function countPersonalPerfs() {
  let count = 0;
  try {
    const exercises = JSON.parse(localStorage.getItem("exercise-tracker-data") || "[]");
    count += exercises.length;
  } catch {
    // ignore malformed local data
  }
  try {
    const sportsData = JSON.parse(localStorage.getItem("exercise-tracker-sports") || "{}");
    count += Object.values(sportsData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  } catch {
    // ignore malformed local data
  }
  return count;
}

async function getMyFriendUids(uid) {
  const requestsRef = collection(db, "friendRequests");
  const [asFromSnap, asToSnap] = await Promise.all([
    getDocs(query(requestsRef, where("fromUid", "==", uid), where("status", "==", "accepted"))),
    getDocs(query(requestsRef, where("toUid", "==", uid), where("status", "==", "accepted"))),
  ]).catch(() => []);
  return [
    ...(asFromSnap ? asFromSnap.docs.map((d) => d.data().toUid) : []),
    ...(asToSnap ? asToSnap.docs.map((d) => d.data().fromUid) : []),
  ];
}

// Same duration -> end-timestamp math as challenges.js's challengeEndDate,
// duplicated here since profile.js doesn't share its module scope.
function isChallengeEnded(challenge) {
  if (!challenge.activatedAt) return false;
  const end = challenge.activatedAt.toDate ? challenge.activatedAt.toDate() : new Date(challenge.activatedAt);
  end.setMonth(end.getMonth() + (challenge.durationMonths || 0));
  end.setDate(end.getDate() + (challenge.durationDays || 0));
  end.setHours(end.getHours() + (challenge.durationHours || 0));
  return Date.now() >= end.getTime();
}

async function computeGeneralStats() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const rankPool = [];
  let firstPlaces = 0;
  let challengeEntryCount = 0;
  let wins = 0;

  const friendUids = await getMyFriendUids(uid);

  // ---- Classement side: every sport+preset I have an entry for. ----
  const myEntriesSnap = await getDocs(query(collection(db, "leaderboardEntries"), where("uid", "==", uid))).catch(() => null);
  if (myEntriesSnap) {
    for (const entryDoc of myEntriesSnap.docs) {
      const mine = entryDoc.data();
      const groupSnaps = await Promise.all(
        friendUids.map((fuid) => getDoc(doc(db, "leaderboardEntries", `${fuid}_${mine.sport}_${mine.presetKey}`)).catch(() => null))
      );
      const friendRows = groupSnaps.filter((s) => s && s.exists()).map((s) => s.data());
      if (friendRows.length < MIN_RIVALS_FOR_RANKING) continue;
      const rows = [mine, ...friendRows].sort((a, b) =>
        mine.sport === "fitness" ? b.totalSeconds - a.totalSeconds : a.totalSeconds - b.totalSeconds
      );
      const myRank = rows.findIndex((r) => r.uid === uid) + 1;
      rankPool.push(myRank);
      if (myRank === 1) firstPlaces++;
    }
  }

  // ---- Défis side: every challenge I've accepted an invite to. ----
  const partSnap = await getDocs(query(collection(db, "challengeParticipants"), where("uid", "==", uid))).catch(() => null);
  if (partSnap) {
    const accepted = partSnap.docs.map((d) => d.data()).filter((p) => p.status === "accepted");
    const challengeSnaps = await Promise.all(accepted.map((p) => getDoc(doc(db, "challenges", p.challengeId))));
    for (const challengeSnap of challengeSnaps) {
      if (!challengeSnap.exists()) continue;
      const challenge = { id: challengeSnap.id, ...challengeSnap.data() };
      const entriesSnap = await getDocs(query(collection(db, "challengeEntries"), where("challengeId", "==", challenge.id))).catch(
        () => null
      );
      if (!entriesSnap) continue;
      const rows = entriesSnap.docs.map((d) => d.data());
      const myRow = rows.find((r) => r.uid === uid);
      if (myRow) challengeEntryCount++;
      const others = rows.filter((r) => r.uid !== uid);
      if (!myRow || others.length < MIN_RIVALS_FOR_RANKING) continue;
      const sorted = [...rows].sort((a, b) => (challenge.sport === "fitness" ? b.value - a.value : a.value - b.value));
      const myRank = sorted.findIndex((r) => r.uid === uid) + 1;
      rankPool.push(myRank);
      if (myRank === 1 && isChallengeEnded(challenge)) wins++;
    }
  }

  return {
    total: countPersonalPerfs() + challengeEntryCount,
    wins,
    avgRank: rankPool.length ? rankPool.reduce((a, b) => a + b, 0) / rankPool.length : null,
    firstPlaces,
    friendCount: friendUids.length,
    streak: computeCurrentStreak(),
  };
}

// A "day logged" is any date with at least one personal perf - streak counts
// consecutive days back from today (or yesterday, so logging nothing yet
// today doesn't zero out a streak still in progress).
function localDateISO(d) {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, 10);
}

function computeCurrentStreak() {
  const days = new Set();
  try {
    const exercises = JSON.parse(localStorage.getItem("exercise-tracker-data") || "[]");
    exercises.forEach((e) => e.date && days.add(e.date));
  } catch {
    // ignore malformed local data
  }
  try {
    const sportsData = JSON.parse(localStorage.getItem("exercise-tracker-sports") || "{}");
    Object.values(sportsData).forEach((arr) => {
      if (Array.isArray(arr)) arr.forEach((e) => e.date && days.add(e.date));
    });
  } catch {
    // ignore malformed local data
  }
  if (days.size === 0) return 0;

  const cursor = new Date();
  if (!days.has(localDateISO(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDateISO(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

let statsRequestToken = 0;
async function refreshGeneralStats() {
  const token = ++statsRequestToken;
  const stats = await computeGeneralStats();
  if (token !== statsRequestToken || !stats) return; // a newer refresh (or sign-out) superseded this one
  statTotalCountEl.textContent = String(stats.total);
  statChallengesWonEl.textContent = String(stats.wins);
  statAvgRankEl.textContent = stats.avgRank == null ? "—" : stats.avgRank.toFixed(1);
  statFirstPlacesEl.textContent = String(stats.firstPlaces);
  statFriendCountEl.textContent = String(stats.friendCount);
  statStreakEl.textContent = String(stats.streak);
}

// ---- Per-sport stats: personal-tracking numbers only (Classement/Défis are
// already covered in Général), computed straight from localStorage so
// switching sports is instant. ----
const ICON_COUNT = '<path d="M4 20V10"/><path d="M12 20V4"/><path d="M20 20v-7"/>';
const ICON_ROUTE = '<path d="M9 19l-2 -3h9a3 3 0 0 0 0 -6h-11a3 3 0 0 1 0 -6h9"/>';
const ICON_CLOCK = '<circle cx="12" cy="13" r="8"/><path d="M12 13V9"/><path d="M9 3h6"/><path d="M12 3v2"/>';
const ICON_TARGET = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>';
const ICON_ELEVATION = '<path d="M6 4v16"/><path d="M3 7l3-3 3 3"/><path d="M18 20V4"/><path d="M21 17l-3 3-3-3"/>';
const ICON_TROPHY =
  '<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4.5a2 2 0 0 0 0 4H7"/><path d="M17 5h2.5a2 2 0 0 1 0 4H17"/><path d="M12 13v4"/><path d="M9.5 17h5l.5 4h-6l.5-4Z"/>';
const ICON_DUMBBELL =
  '<path d="M2 12h1"/><path d="M6 8h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2"/><path d="M6 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1"/><path d="M9 12h6"/><path d="M15 7v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1 -1v-10a1 1 0 0 0 -1 -1h-1a1 1 0 0 0 -1 1"/><path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-2"/><path d="M22 12h-1"/>';
const ICON_PACE =
  '<path d="M12 12l3 -3"/><path d="M12 6v-2"/><path d="M4.5 9.5l-1 -1"/><path d="M4 15h-2"/><path d="M20 15h-2"/><path d="M19.5 9.5l1 -1"/><circle cx="12" cy="15" r="6"/>';

function loadSportEntries(sport) {
  try {
    const sportsData = JSON.parse(localStorage.getItem("exercise-tracker-sports") || "{}");
    return Array.isArray(sportsData[sport]) ? sportsData[sport] : [];
  } catch {
    return [];
  }
}

function loadFitnessEntries() {
  try {
    return JSON.parse(localStorage.getItem("exercise-tracker-data") || "[]");
  } catch {
    return [];
  }
}

function entrySeconds(perf) {
  return (perf.hours ?? 0) * 3600 + (perf.minutes ?? 0) * 60 + (perf.seconds ?? 0) + (perf.hundredths ?? 0) / 100;
}

function triathlonEntrySeconds(perf) {
  const leg = (l) => (l?.hours ?? 0) * 3600 + (l?.minutes ?? 0) * 60 + (l?.seconds ?? 0) + (l?.hundredths ?? 0) / 100;
  return leg(perf.swim) + leg(perf.bike) + leg(perf.run);
}

function formatHoursMinutes(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatPace(secondsPerUnit) {
  if (!secondsPerUnit || !Number.isFinite(secondsPerUnit)) return "—";
  const unit = window.kmUnitLabel ? window.kmUnitLabel() : "km";
  const m = Math.floor(secondsPerUnit / 60);
  const s = Math.round(secondsPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")}/${unit}`;
}

function distinctGroupCount(entries, groupKeyFn) {
  const keys = new Set();
  entries.forEach((e) => {
    const key = groupKeyFn(e);
    if (key != null && key !== "") keys.add(key);
  });
  return keys.size;
}

function tile(icon, value, labelKey, memoKey) {
  return `<div class="stat-tile" data-memo="${memoKey}"><span class="stat-tile-icon"><svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span><span class="stat-tile-value">${value}</span><span class="stat-tile-label">${t(labelKey)}</span></div>`;
}

function renderSportStats(sport) {
  if (sport === "fitness") {
    const entries = loadFitnessEntries();
    const distinctExercises = distinctGroupCount(entries, (e) => e.exerciseKey || e.name);
    const totalReps = entries.reduce((sum, e) => sum + (typeof e.maxReps === "number" ? e.maxReps : 0), 0);
    const totalWeight = entries.reduce((sum, e) => sum + (typeof e.maxWeight === "number" ? e.maxWeight : 0), 0);
    statisticsSportContent.innerHTML =
      tile(ICON_COUNT, entries.length, "statistics.totalStats", "statistics.memoTotalSport") +
      tile(ICON_TARGET, distinctExercises, "statistics.distinctExercises", "statistics.memoDistinctExercises") +
      tile(ICON_COUNT, totalReps, "statistics.totalReps", "statistics.memoTotalReps") +
      tile(ICON_DUMBBELL, `${window.weightToDisplay ? window.weightToDisplay(totalWeight) : totalWeight} ${window.weightUnitLabel ? window.weightUnitLabel() : "kg"}`, "statistics.totalWeight", "statistics.memoTotalWeight");
    return;
  }

  if (sport === "triathlon") {
    const entries = loadSportEntries("triathlon");
    const totalSeconds = entries.reduce((sum, e) => sum + triathlonEntrySeconds(e), 0);
    const bestSeconds = entries.length ? Math.min(...entries.map(triathlonEntrySeconds)) : null;
    const distinctSizes = distinctGroupCount(entries, (e) => e.size);
    statisticsSportContent.innerHTML =
      tile(ICON_COUNT, entries.length, "statistics.totalStats", "statistics.memoTotalSport") +
      tile(ICON_CLOCK, formatHoursMinutes(totalSeconds), "statistics.totalTime", "statistics.memoTime") +
      tile(ICON_TROPHY, bestSeconds == null ? "—" : formatHoursMinutes(bestSeconds), "statistics.bestTime", "statistics.memoBestTime") +
      tile(ICON_TARGET, distinctSizes, "statistics.distinctSizes", "statistics.memoDistinctSizes");
    return;
  }

  // course, natation, velo, randonnee
  const entries = loadSportEntries(sport);
  const totalDistance = entries.reduce((sum, e) => sum + (e.distance || 0), 0);
  const isNatation = sport === "natation";
  const distanceDisplay = isNatation
    ? `${window.mToDisplay ? window.mToDisplay(totalDistance) : totalDistance} ${window.mUnitLabel ? window.mUnitLabel() : "m"}`
    : `${window.kmToDisplay ? window.kmToDisplay(totalDistance) : totalDistance} ${window.kmUnitLabel ? window.kmUnitLabel() : "km"}`;
  const groupKeyFn = isNatation ? (e) => `${e.distance}-${e.text}` : (e) => e.distance;

  if (sport === "randonnee" || sport === "trail") {
    const totalElevation = entries.reduce((sum, e) => sum + (e.elevationGain || 0) + (e.elevationLoss || 0), 0);
    statisticsSportContent.innerHTML =
      tile(ICON_COUNT, entries.length, "statistics.totalStats", "statistics.memoTotalSport") +
      tile(ICON_ROUTE, distanceDisplay, "statistics.totalDistance", "statistics.memoDistance") +
      tile(ICON_ELEVATION, `${window.mToDisplay ? window.mToDisplay(totalElevation) : totalElevation} ${window.mUnitLabel ? window.mUnitLabel() : "m"}`, "statistics.totalElevation", "statistics.memoElevation") +
      tile(ICON_TARGET, distinctGroupCount(entries, groupKeyFn), "statistics.distinctDistances", "statistics.memoDistinctDistances");
    return;
  }

  const totalSeconds = entries.reduce((sum, e) => sum + entrySeconds(e), 0);
  statisticsSportContent.innerHTML =
    tile(ICON_COUNT, entries.length, "statistics.totalStats", "statistics.memoTotalSport") +
    tile(ICON_ROUTE, distanceDisplay, "statistics.totalDistance", "statistics.memoDistance") +
    tile(ICON_CLOCK, formatHoursMinutes(totalSeconds), "statistics.totalTime", "statistics.memoTime") +
    tile(ICON_TARGET, distinctGroupCount(entries, groupKeyFn), "statistics.distinctDistances", "statistics.memoDistinctDistances");

  // Course and Vélo also get an average pace per displayed distance unit -
  // not meaningful for Natation (tracked in meters, not km) or the branches
  // handled above.
  if (sport === "course" || sport === "velo") {
    const displayDistance = window.kmToDisplay ? window.kmToDisplay(totalDistance) : totalDistance;
    const paceSecondsPerUnit = displayDistance > 0 ? totalSeconds / displayDistance : null;
    statisticsSportContent.innerHTML += tile(ICON_PACE, formatPace(paceSecondsPerUnit), "statistics.avgPace", "statistics.memoAvgPace");
  }
}

selectStatFilter(statisticsMenuEl.querySelector('.sport-option[data-stat="general"]'));

document.addEventListener(
  "click",
  (e) => {
    const tileEl = e.target.closest(".stat-tile[data-memo]");
    if (!tileEl) return;
    e.stopPropagation();
    tileEl.dataset.popupId = tileEl.dataset.popupId || `stat-${tileEl.dataset.memo}`;
    window.showFloatingPopup(tileEl, `<p class="tri-popup-text">${t(tileEl.dataset.memo)}</p>`);
  },
  true
);

document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    supportViewEl.hidden = true;
    statisticsViewEl.hidden = true;
  });
});

// ---- App version, shown at the bottom of Support - read from the native
// app itself (App.getInfo()) so it's always accurate without having to keep
// a hardcoded string in sync with android/app/build.gradle by hand ----
function renderAppVersion(targetEl) {
  if (!targetEl) return;
  const isNativePlatformForVersion = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  if (!isNativePlatformForVersion) return;
  // Always show *something* immediately, and keep it visible even if
  // getInfo() fails, instead of silently staying hidden - a stuck "loading"
  // or an explicit error is far more useful for debugging "which build is
  // actually installed" than an empty screen that looks like nothing ran.
  targetEl.hidden = false;
  targetEl.textContent = "Best Perfs (chargement de la version...)";
  if (!Capacitor.Plugins || !Capacitor.Plugins.App || !Capacitor.Plugins.App.getInfo) {
    targetEl.textContent = "Best Perfs (App.getInfo indisponible)";
    return;
  }
  Capacitor.Plugins.App.getInfo()
    .then((info) => {
      targetEl.textContent = `Best Perfs v${info.version} (${info.build})`;
    })
    .catch((error) => {
      targetEl.textContent = `Best Perfs (version indisponible : ${error?.message || error})`;
    });
}
renderAppVersion(document.getElementById("app-version-label"));
renderAppVersion(document.getElementById("landing-version-tag"));
