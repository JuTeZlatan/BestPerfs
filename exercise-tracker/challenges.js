import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from "./firebase-init.js";

function myUid() {
  return auth.currentUser?.uid || null;
}

function myUsername() {
  const el = document.getElementById("account-username-display");
  return el ? el.textContent.trim() : "";
}

function todayISO() {
  return window.todayISO ? window.todayISO() : new Date().toISOString().slice(0, 10);
}

// ---- DOM refs ----
const challengesViewEl = document.getElementById("challenges-view");
const challengeCreateToggle = document.getElementById("challenge-create-toggle");
const challengeCreateBackBtn = document.getElementById("challenge-create-back-btn");
const challengeCreateView = document.getElementById("challenge-create-view");
const challengeDetailView = document.getElementById("challenge-detail-view");
const challengeDetailBackBtn = document.getElementById("challenge-detail-back-btn");

const challengesTabBtns = Array.from(challengesViewEl.querySelectorAll(".friends-tab-btn"));
const challengesTabViewport = document.getElementById("challenges-tab-viewport");
const challengesTabTrack = document.getElementById("challenges-tab-track");
let challengesActiveTabIndex = 0;

function setChallengesActiveTab(index) {
  challengesActiveTabIndex = index;
  challengesTabBtns.forEach((btn, i) => btn.classList.toggle("active", i === index));
  challengesTabTrack.style.transform = `translateX(-${index * 100}%)`;
}

challengesTabBtns.forEach((btn, i) => {
  btn.addEventListener("click", () => setChallengesActiveTab(i));
});

let challengesTouchStartX = 0;
let challengesTouchStartY = 0;
challengesTabViewport.addEventListener("touchstart", (e) => {
  challengesTouchStartX = e.touches[0].clientX;
  challengesTouchStartY = e.touches[0].clientY;
});
challengesTabViewport.addEventListener("touchend", (e) => {
  const deltaX = e.changedTouches[0].clientX - challengesTouchStartX;
  const deltaY = e.changedTouches[0].clientY - challengesTouchStartY;
  if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
  if (deltaX < 0 && challengesActiveTabIndex < challengesTabBtns.length - 1) setChallengesActiveTab(challengesActiveTabIndex + 1);
  else if (deltaX > 0 && challengesActiveTabIndex > 0) setChallengesActiveTab(challengesActiveTabIndex - 1);
});

const challengesMyList = document.getElementById("challenges-my-list");
const challengesMyEmpty = document.getElementById("challenges-my-empty");
const challengesInvitesList = document.getElementById("challenges-invites-list");
const challengesInvitesEmpty = document.getElementById("challenges-invites-empty");

const challengeRowTemplate = document.getElementById("challenge-row-template");
const challengeInviteTemplate = document.getElementById("challenge-invite-template");
const challengeFriendCheckTemplate = document.getElementById("challenge-friend-check-template");
const challengeRankingRowTemplate = document.getElementById("challenge-ranking-row-template");

// ---- Sport/preset labels+icons+formatting come from leaderboard.js's
// window.SportData - same disciplines, same value formatting. ----
function sportLabel(sport) {
  return t(window.SportData.CLASSEMENT_SPORT_LABEL_KEYS[sport]);
}
function sportIcon(sport) {
  return window.SportData.CLASSEMENT_SPORT_ICONS[sport] || "";
}
function formatChallengeValue(sport, presetKey, value) {
  return sport === "fitness" ? window.SportData.formatFitnessValue(value, presetKey) : window.SportData.formatSeconds(value);
}
function presetDisplayLabel(sport, presetKey) {
  if (sport === "natation") {
    const [distance, stroke] = presetKey.split("-");
    return `${distance} m · ${t(`swimStroke.${stroke}`)}`;
  }
  if (sport === "course" && (presetKey === "half" || presetKey === "marathon")) return t(`sport.${presetKey === "half" ? "halfMarathon" : "marathon"}`);
  if (sport === "course") return Number(presetKey) >= 1 ? `${presetKey} km` : `${Number(presetKey) * 1000} m`;
  if (sport === "velo") return `${presetKey} km`;
  if (sport === "triathlon") return presetKey;
  return t(`exercise.${presetKey}`);
}
function formatChallengeDates(startDate, endDate) {
  const fmt = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  return `${fmt(startDate)} → ${fmt(endDate)}`;
}

// ---- Create-challenge sport/preset picker (mirrors leaderboard.js's
// classement picker, same widgets, separate state/IDs). ----
const ccSportBtn = document.getElementById("challenge-create-sport-select-btn");
const ccSportLabel = document.getElementById("challenge-create-sport-select-label");
const ccSportIcon = document.getElementById("challenge-create-sport-select-icon");
const ccSportMenu = document.getElementById("challenge-create-sport-menu");
const ccPresetSelects = {
  course: document.getElementById("challenge-create-preset-course"),
  natation: document.getElementById("challenge-create-preset-natation"),
  triathlon: document.getElementById("challenge-create-preset-triathlon"),
  velo: document.getElementById("challenge-create-preset-velo"),
  fitness: document.getElementById("challenge-create-preset-fitness"),
};
const ccNatationStrokeSelect = document.getElementById("challenge-create-preset-natation-stroke");
const ccStartInput = document.getElementById("challenge-create-start-input");
const ccEndInput = document.getElementById("challenge-create-end-input");
const ccFriendsList = document.getElementById("challenge-create-friends-list");
const ccFriendsEmpty = document.getElementById("challenge-create-friends-empty");
const ccErrorEl = document.getElementById("challenge-create-error");
const ccSubmitBtn = document.getElementById("challenge-create-submit-btn");

let ccSport = "course";
let ccPreset = null;
let ccNatationDistance = null;
let ccNatationStroke = null;

function ccUpdateSportLabel() {
  ccSportLabel.textContent = sportLabel(ccSport);
  ccSportIcon.innerHTML = sportIcon(ccSport);
}

function ccResetPresetDropdown(dropdown) {
  const label = dropdown.querySelector(".classement-preset-label");
  const defaultKey = label.dataset.defaultI18n || "classement.choosePreset";
  label.textContent = t(defaultKey);
  label.dataset.i18n = defaultKey;
  dropdown.querySelectorAll(".sport-option").forEach((btn) => btn.classList.remove("active"));
  dropdown.querySelector(".classement-preset-menu").hidden = true;
}

function ccSelectSport(sport) {
  ccSport = sport;
  ccPreset = null;
  ccNatationDistance = null;
  ccNatationStroke = null;
  ccSportMenu.querySelectorAll(".sport-option").forEach((btn) => btn.classList.toggle("active", btn.dataset.sport === sport));
  Object.keys(ccPresetSelects).forEach((key) => {
    ccPresetSelects[key].hidden = key !== sport;
    ccResetPresetDropdown(ccPresetSelects[key]);
  });
  ccNatationStrokeSelect.hidden = sport !== "natation";
  ccResetPresetDropdown(ccNatationStrokeSelect);
  ccUpdateSportLabel();
}

ccSportBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const opening = ccSportMenu.hidden;
  window.closeAllDropdowns();
  ccSportMenu.hidden = !opening;
});

ccSportMenu.querySelectorAll(".sport-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    ccSelectSport(btn.dataset.sport);
    ccSportMenu.hidden = true;
  });
});

document.addEventListener("click", (e) => {
  if (!ccSportMenu.hidden && !ccSportMenu.contains(e.target) && e.target !== ccSportBtn) ccSportMenu.hidden = true;
  [...Object.values(ccPresetSelects), ccNatationStrokeSelect].forEach((dropdown) => {
    const menu = dropdown.querySelector(".classement-preset-menu");
    if (!menu.hidden && !dropdown.contains(e.target)) menu.hidden = true;
  });
});

function ccUpdateNatationPreset() {
  ccPreset = ccNatationDistance && ccNatationStroke ? `${ccNatationDistance}-${ccNatationStroke}` : null;
}

function ccBindPresetDropdown(dropdown, onSelect) {
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

Object.entries(ccPresetSelects).forEach(([sport, dropdown]) => {
  if (sport === "natation") {
    ccBindPresetDropdown(dropdown, (value) => {
      ccNatationDistance = value;
      ccUpdateNatationPreset();
    });
  } else {
    ccBindPresetDropdown(dropdown, (value) => {
      ccPreset = value;
    });
  }
});

ccBindPresetDropdown(ccNatationStrokeSelect, (value) => {
  ccNatationStroke = value;
  ccUpdateNatationPreset();
});

document.addEventListener("languagechange", () => {
  ccUpdateSportLabel();
  const activeDropdown = ccPresetSelects[ccSport];
  const activeOption = activeDropdown?.querySelector(".sport-option.active");
  if (activeOption) activeDropdown.querySelector(".classement-preset-label").textContent = activeOption.textContent;
});

// ---- Friends list (for invite multi-select) - a small local query, same
// pattern already used independently in friends.js/leaderboard.js. ----
async function getMyFriends() {
  const uid = myUid();
  if (!uid) return [];
  const requestsRef = collection(db, "friendRequests");
  const [asFromSnap, asToSnap] = await Promise.all([
    getDocs(query(requestsRef, where("fromUid", "==", uid), where("status", "==", "accepted"))),
    getDocs(query(requestsRef, where("toUid", "==", uid), where("status", "==", "accepted"))),
  ]).catch(() => []);
  if (!asFromSnap) return [];
  return [
    ...asFromSnap.docs.map((d) => ({ uid: d.data().toUid, username: d.data().toUsername })),
    ...asToSnap.docs.map((d) => ({ uid: d.data().fromUid, username: d.data().fromUsername })),
  ].sort((a, b) => a.username.localeCompare(b.username));
}

async function renderCreateFriendsList() {
  const friends = await getMyFriends();
  ccFriendsList.innerHTML = "";
  ccFriendsEmpty.classList.toggle("visible", friends.length === 0);
  friends.forEach((friend) => {
    const node = challengeFriendCheckTemplate.content.cloneNode(true);
    node.querySelector(".friend-row-name").textContent = friend.username;
    const checkbox = node.querySelector(".challenge-friend-checkbox");
    checkbox.value = friend.uid;
    checkbox.dataset.username = friend.username;
    ccFriendsList.appendChild(node);
  });
}

function openChallengeCreateView() {
  challengesViewEl.hidden = true;
  challengeCreateView.hidden = false;
  clearFieldError(ccErrorEl);
  ccSelectSport("course");
  const today = todayISO();
  ccStartInput.value = today;
  ccEndInput.value = today;
  renderCreateFriendsList();
}

function clearFieldError(el) {
  el.hidden = true;
  el.textContent = "";
}

function showFieldError(el, key) {
  el.textContent = t(key);
  el.hidden = false;
}

challengeCreateToggle.addEventListener("click", openChallengeCreateView);

challengeCreateBackBtn.addEventListener("click", () => {
  challengeCreateView.hidden = true;
  challengesViewEl.hidden = false;
});

ccSubmitBtn.addEventListener("click", async () => {
  clearFieldError(ccErrorEl);
  const uid = myUid();
  const username = myUsername();
  if (!uid || !username) return;
  if (!ccPreset) {
    showFieldError(ccErrorEl, "challenges.errorNoPreset");
    return;
  }
  if (!ccStartInput.value || !ccEndInput.value) {
    showFieldError(ccErrorEl, "challenges.errorNoDates");
    return;
  }
  if (ccEndInput.value < ccStartInput.value) {
    showFieldError(ccErrorEl, "challenges.errorDateOrder");
    return;
  }
  const invitedUids = Array.from(ccFriendsList.querySelectorAll(".challenge-friend-checkbox:checked")).map((cb) => ({
    uid: cb.value,
    username: cb.dataset.username,
  }));

  try {
    const challengeRef = doc(collection(db, "challenges"));
    const batch = writeBatch(db);
    batch.set(challengeRef, {
      creatorUid: uid,
      creatorUsername: username,
      sport: ccSport,
      presetKey: ccPreset,
      startDate: ccStartInput.value,
      endDate: ccEndInput.value,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, "challengeParticipants", `${challengeRef.id}_${uid}`), {
      challengeId: challengeRef.id,
      uid,
      username,
      status: "accepted",
      invitedBy: uid,
      createdAt: serverTimestamp(),
    });
    invitedUids.forEach((friend) => {
      batch.set(doc(db, "challengeParticipants", `${challengeRef.id}_${friend.uid}`), {
        challengeId: challengeRef.id,
        uid: friend.uid,
        username: friend.username,
        status: "pending",
        invitedBy: uid,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
    challengeCreateView.hidden = true;
    challengesViewEl.hidden = false;
    refreshChallengesData();
  } catch (error) {
    console.error(error);
    showFieldError(ccErrorEl, "friends.errorGeneric");
  }
});

// ---- List: my challenges (accepted) + invitations (pending) ----
async function refreshChallengesData() {
  const uid = myUid();
  if (!uid) return;
  const snap = await getDocs(query(collection(db, "challengeParticipants"), where("uid", "==", uid))).catch(() => null);
  if (!snap) return;

  const accepted = snap.docs.map((d) => d.data()).filter((p) => p.status === "accepted");
  const pending = snap.docs.map((d) => d.data()).filter((p) => p.status === "pending");

  const [acceptedChallenges, pendingChallenges] = await Promise.all([
    Promise.all(accepted.map((p) => getDoc(doc(db, "challenges", p.challengeId)))),
    Promise.all(pending.map((p) => getDoc(doc(db, "challenges", p.challengeId)))),
  ]);

  const myChallenges = acceptedChallenges
    .map((s, i) => (s.exists() ? { id: s.id, ...s.data() } : null))
    .filter(Boolean)
    .sort((a, b) => (a.endDate < b.endDate ? 1 : -1));

  const myInvites = pendingChallenges
    .map((s, i) => (s.exists() ? { id: s.id, ...s.data() } : null))
    .filter(Boolean);

  renderMyChallenges(myChallenges);
  renderInvites(myInvites);
}

function renderMyChallenges(challenges) {
  challengesMyList.innerHTML = "";
  challengesMyEmpty.classList.toggle("visible", challenges.length === 0);
  challenges.forEach((challenge) => {
    const node = challengeRowTemplate.content.cloneNode(true);
    node.querySelector(".challenge-row-icon").innerHTML = sportIcon(challenge.sport);
    node.querySelector(".challenge-row-title").textContent = `${sportLabel(challenge.sport)} · ${presetDisplayLabel(challenge.sport, challenge.presetKey)}`;
    node.querySelector(".challenge-row-dates").textContent = formatChallengeDates(challenge.startDate, challenge.endDate);
    node.querySelector(".challenge-row").addEventListener("click", () => openChallengeDetail(challenge));
    challengesMyList.appendChild(node);
  });
}

function renderInvites(invites) {
  challengesInvitesList.innerHTML = "";
  challengesInvitesEmpty.classList.toggle("visible", invites.length === 0);
  invites.forEach((challenge) => {
    const node = challengeInviteTemplate.content.cloneNode(true);
    node.querySelector(".challenge-row-icon").innerHTML = sportIcon(challenge.sport);
    node.querySelector(".challenge-row-title").textContent = `${challenge.creatorUsername} · ${sportLabel(challenge.sport)} · ${presetDisplayLabel(challenge.sport, challenge.presetKey)}`;
    node.querySelector(".challenge-row-dates").textContent = formatChallengeDates(challenge.startDate, challenge.endDate);

    node.querySelector(".challenge-accept-btn").addEventListener("click", async () => {
      const uid = myUid();
      try {
        await updateDoc(doc(db, "challengeParticipants", `${challenge.id}_${uid}`), { uid, status: "accepted" });
      } catch (error) {
        console.error(error);
      }
      refreshChallengesData();
    });
    node.querySelector(".challenge-decline-btn").addEventListener("click", async () => {
      const uid = myUid();
      try {
        await updateDoc(doc(db, "challengeParticipants", `${challenge.id}_${uid}`), { uid, status: "declined" });
      } catch (error) {
        console.error(error);
      }
      refreshChallengesData();
    });

    challengesInvitesList.appendChild(node);
  });
}

// ---- Challenge detail: real-time ranking via onSnapshot ----
const challengeDetailTitle = document.getElementById("challenge-detail-title");
const challengeDetailDates = document.getElementById("challenge-detail-dates");
const challengeDetailList = document.getElementById("challenge-detail-list");
const challengeDetailEmpty = document.getElementById("challenge-detail-empty");
const challengeLeaveBtn = document.getElementById("challenge-leave-btn");

const challengeEntryFitnessFields = document.getElementById("challenge-entry-fitness-fields");
const challengeEntryFitnessInput = document.getElementById("challenge-entry-fitness-input");
const challengeEntryTimeFields = document.getElementById("challenge-entry-time-fields");
const challengeEntryHInput = document.getElementById("challenge-entry-h-input");
const challengeEntryMInput = document.getElementById("challenge-entry-m-input");
const challengeEntrySInput = document.getElementById("challenge-entry-s-input");
const challengeEntryCsInput = document.getElementById("challenge-entry-cs-input");
const challengeEntrySubmitBtn = document.getElementById("challenge-entry-submit-btn");
const challengeEntryClosedMsg = document.getElementById("challenge-entry-closed-msg");

let currentChallenge = null;
let detailUnsubscribe = null;

function challengeIsActive(challenge) {
  const today = todayISO();
  return challenge.startDate <= today && today <= challenge.endDate;
}

// Personal sport/exercise logs and challenge performances are deliberately
// separate: a challenge entry is only ever what a participant explicitly
// enters here, for that challenge, while it's running - never derived from
// their regular tracked stats.
function setupChallengeEntryForm(challenge) {
  const active = challengeIsActive(challenge);
  challengeEntrySubmitBtn.hidden = !active;
  challengeEntryClosedMsg.hidden = active;
  challengeEntryFitnessFields.hidden = !active || challenge.sport !== "fitness";
  challengeEntryTimeFields.hidden = !active || challenge.sport === "fitness";
  if (challenge.sport === "fitness") {
    const metric = window.SportData.FITNESS_METRIC[challenge.presetKey];
    challengeEntryFitnessInput.placeholder = metric === "weight" ? window.weightUnitLabel() : t("field.reps");
    challengeEntryFitnessInput.step = metric === "weight" ? "0.5" : "1";
  }
}

function fillChallengeEntryForm(challenge, value) {
  if (value == null) return;
  if (challenge.sport === "fitness") {
    challengeEntryFitnessInput.value = value;
    return;
  }
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = Math.floor(value % 60);
  const cs = Math.round((value - Math.floor(value)) * 100);
  challengeEntryHInput.value = h || "";
  challengeEntryMInput.value = m || "";
  challengeEntrySInput.value = s || "";
  challengeEntryCsInput.value = cs || "";
}

challengeEntrySubmitBtn.addEventListener("click", async () => {
  if (!currentChallenge || !challengeIsActive(currentChallenge)) return;
  const uid = myUid();
  const username = myUsername();
  if (!uid || !username) return;

  let value;
  if (currentChallenge.sport === "fitness") {
    value = Number(challengeEntryFitnessInput.value);
    if (!Number.isFinite(value) || challengeEntryFitnessInput.value === "") return;
  } else {
    const h = Number(challengeEntryHInput.value) || 0;
    const m = Number(challengeEntryMInput.value) || 0;
    const s = Number(challengeEntrySInput.value) || 0;
    const cs = Number(challengeEntryCsInput.value) || 0;
    value = h * 3600 + m * 60 + s + cs / 100;
    if (value <= 0) return;
  }

  try {
    await setDoc(doc(db, "challengeEntries", `${currentChallenge.id}_${uid}`), {
      challengeId: currentChallenge.id,
      uid,
      username,
      sport: currentChallenge.sport,
      presetKey: currentChallenge.presetKey,
      value,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(error);
  }
});

new MutationObserver(() => {
  if (challengeDetailView.hidden && detailUnsubscribe) {
    detailUnsubscribe();
    detailUnsubscribe = null;
  }
}).observe(challengeDetailView, { attributes: true, attributeFilter: ["hidden"] });

function openChallengeDetail(challenge) {
  currentChallenge = challenge;
  challengesViewEl.hidden = true;
  challengeDetailView.hidden = false;
  challengeDetailTitle.textContent = `${sportLabel(challenge.sport)} · ${presetDisplayLabel(challenge.sport, challenge.presetKey)}`;
  challengeDetailDates.textContent = formatChallengeDates(challenge.startDate, challenge.endDate);
  setupChallengeEntryForm(challenge);

  if (detailUnsubscribe) detailUnsubscribe();
  detailUnsubscribe = onSnapshot(
    query(collection(db, "challengeEntries"), where("challengeId", "==", challenge.id)),
    (snap) => renderChallengeRanking(challenge, snap.docs.map((d) => d.data())),
    (error) => console.error(error)
  );
}

function renderChallengeRanking(challenge, rows) {
  const uid = myUid();
  const myRow = rows.find((r) => r.uid === uid);
  if (myRow) fillChallengeEntryForm(challenge, myRow.value);
  const sorted = [...rows].sort((a, b) =>
    challenge.sport === "fitness" ? b.value - a.value : a.value - b.value
  );
  challengeDetailList.innerHTML = "";
  challengeDetailEmpty.classList.toggle("visible", sorted.length === 0);
  sorted.forEach((row, index) => {
    const node = challengeRankingRowTemplate.content.cloneNode(true);
    const card = node.querySelector(".exercise-card");
    const rankEl = node.querySelector(".classement-rank");
    rankEl.textContent = String(index + 1);
    rankEl.classList.toggle("rank-gold", index === 0);
    rankEl.classList.toggle("rank-silver", index === 1);
    rankEl.classList.toggle("rank-bronze", index === 2);
    node.querySelector(".classement-name").textContent = row.uid === uid ? `${row.username} ${t("classement.you")}` : row.username;
    if (row.uid === uid) card.classList.add("classement-row-you");
    node.querySelector(".classement-time").textContent = formatChallengeValue(challenge.sport, challenge.presetKey, row.value);
    challengeDetailList.appendChild(node);
  });
}

challengeDetailBackBtn.addEventListener("click", () => {
  challengeDetailView.hidden = true;
  challengesViewEl.hidden = false;
});

challengeLeaveBtn.addEventListener("click", () => {
  if (!currentChallenge) return;
  window.openConfirmModal(t("challenges.leaveConfirm"), async () => {
    const uid = myUid();
    try {
      await deleteDoc(doc(db, "challengeParticipants", `${currentChallenge.id}_${uid}`));
      await deleteDoc(doc(db, "challengeEntries", `${currentChallenge.id}_${uid}`)).catch(() => {});
    } catch (error) {
      console.error(error);
    }
    challengeDetailView.hidden = true;
    challengesViewEl.hidden = false;
    refreshChallengesData();
  });
});

// ---- Entry point: the bottom-nav "Défis" tab, and notification clicks. ----
function openChallengesView(tabIndex) {
  window.showView("challenges");
  challengeCreateView.hidden = true;
  challengeDetailView.hidden = true;
  challengesViewEl.hidden = false;
  setChallengesActiveTab(tabIndex);
  refreshChallengesData();
}
window.openChallengesView = openChallengesView;

document.querySelector('.bottom-nav-btn[data-view="challenges"]').addEventListener("click", () => {
  setChallengesActiveTab(0);
  refreshChallengesData();
});

ccUpdateSportLabel();
