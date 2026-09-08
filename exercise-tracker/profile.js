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
const statisticsEmptyState = document.getElementById("statistics-empty-state");
const statisticsGeneralContent = document.getElementById("statistics-general-content");
const statTotalCountEl = document.getElementById("stat-total-count");
const statChallengesWonEl = document.getElementById("stat-challenges-won");
const statAvgRankEl = document.getElementById("stat-avg-rank");
const statFirstPlacesEl = document.getElementById("stat-first-places");

profileStatisticsRow.addEventListener("click", () => {
  profileViewForSupport.hidden = true;
  statisticsViewEl.hidden = false;
  if (currentStatFilter === "general") refreshGeneralStats();
});

statisticsBackBtn.addEventListener("click", () => {
  statisticsViewEl.hidden = true;
  profileViewForSupport.hidden = false;
});

// ---- Statistics filter dropdown: Général plus every tracked sport. Général
// shows real numbers (below); the other filters are still a later pass, so
// they show the "coming soon" message. ----
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
  statisticsEmptyState.classList.toggle("visible", currentStatFilter !== "general");
  if (currentStatFilter === "general") refreshGeneralStats();
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
  };
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
}

selectStatFilter(statisticsMenuEl.querySelector('.sport-option[data-stat="general"]'));

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
