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

// ---- DOM refs ----
const challengesViewEl = document.getElementById("challenges-view");
const challengeCreateToggle = document.getElementById("challenge-create-toggle");
const challengeCreateBackBtn = document.getElementById("challenge-create-back-btn");
const challengeCreateView = document.getElementById("challenge-create-view");
const challengeDetailView = document.getElementById("challenge-detail-view");
const challengeDetailBackBtn = document.getElementById("challenge-detail-back-btn");

const challengesTabBtns = Array.from(document.getElementById("challenges-main-tab-bar").querySelectorAll(".friends-tab-btn"));
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

const challengesOngoingList = document.getElementById("challenges-ongoing-list");
const challengesOngoingEmpty = document.getElementById("challenges-ongoing-empty");
const challengesEndedList = document.getElementById("challenges-ended-list");
const challengesEndedEmpty = document.getElementById("challenges-ended-empty");
const challengesInvitesList = document.getElementById("challenges-invites-list");
const challengesInvitesEmpty = document.getElementById("challenges-invites-empty");

// ---- "Mes défis" sub-tabs: En cours / Terminés (same swipeable pattern as
// the Mes défis / Invitations tabs above, nested one level deeper). ----
const challengesMySubTabBtns = Array.from(document.getElementById("challenges-my-sub-tab-bar").querySelectorAll(".friends-tab-btn"));
const challengesMyTabViewport = document.getElementById("challenges-my-tab-viewport");
const challengesMyTabTrack = document.getElementById("challenges-my-tab-track");
let challengesMyActiveTabIndex = 0;

function setChallengesMyActiveTab(index) {
  challengesMyActiveTabIndex = index;
  challengesMySubTabBtns.forEach((btn, i) => btn.classList.toggle("active", i === index));
  challengesMyTabTrack.style.transform = `translateX(-${index * 100}%)`;
}

challengesMySubTabBtns.forEach((btn, i) => {
  btn.addEventListener("click", () => setChallengesMyActiveTab(i));
});

let challengesMyTouchStartX = 0;
let challengesMyTouchStartY = 0;
challengesMyTabViewport.addEventListener("touchstart", (e) => {
  challengesMyTouchStartX = e.touches[0].clientX;
  challengesMyTouchStartY = e.touches[0].clientY;
});
challengesMyTabViewport.addEventListener("touchend", (e) => {
  const deltaX = e.changedTouches[0].clientX - challengesMyTouchStartX;
  const deltaY = e.changedTouches[0].clientY - challengesMyTouchStartY;
  if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
  if (deltaX < 0 && challengesMyActiveTabIndex < challengesMySubTabBtns.length - 1) setChallengesMyActiveTab(challengesMyActiveTabIndex + 1);
  else if (deltaX > 0 && challengesMyActiveTabIndex > 0) setChallengesMyActiveTab(challengesMyActiveTabIndex - 1);
});

const challengeRowTemplate = document.getElementById("challenge-row-template");
const challengeInviteTemplate = document.getElementById("challenge-invite-template");
const challengeFriendSelectedTemplate = document.getElementById("challenge-friend-selected-template");
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
// A challenge's duration is months/days/hours picked at creation - it only
// turns into an actual end timestamp once activated (see challengeEndDate).
function formatChallengeDuration(challenge) {
  const parts = [];
  if (challenge.durationMonths) parts.push(`${challenge.durationMonths} ${t(challenge.durationMonths === 1 ? "challenges.unitMonth" : "challenges.unitMonths")}`);
  if (challenge.durationDays) parts.push(`${challenge.durationDays} ${t(challenge.durationDays === 1 ? "challenges.unitDay" : "challenges.unitDays")}`);
  if (challenge.durationHours) parts.push(`${challenge.durationHours} ${t(challenge.durationHours === 1 ? "challenges.unitHour" : "challenges.unitHours")}`);
  return parts.join(" ");
}

function challengeEndDate(challenge) {
  if (!challenge.activatedAt) return null;
  const end = challenge.activatedAt.toDate ? challenge.activatedAt.toDate() : new Date(challenge.activatedAt);
  end.setMonth(end.getMonth() + (challenge.durationMonths || 0));
  end.setDate(end.getDate() + (challenge.durationDays || 0));
  end.setHours(end.getHours() + (challenge.durationHours || 0));
  return end;
}

function formatCountdown(msRemaining) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return days > 0
    ? `${days}j ${pad(hours)}h${pad(minutes)}m${pad(seconds)}s`
    : `${pad(hours)}h${pad(minutes)}m${pad(seconds)}s`;
}

// Row/label text for a challenge's timing: proposed duration while waiting
// on invitees to respond, otherwise remaining time (or "ended").
function challengeTimingLabel(challenge) {
  if (!challenge.activatedAt) return t("challenges.waitingForInvitees");
  const end = challengeEndDate(challenge);
  const msRemaining = end.getTime() - Date.now();
  if (msRemaining <= 0) return t("challenges.ended");
  return t("challenges.timeRemaining", { time: formatCountdown(msRemaining) });
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
const ccFriendAddBtn = document.getElementById("challenge-create-friend-add-btn");
const ccFriendsList = document.getElementById("challenge-create-friends-list");
const ccFriendsEmpty = document.getElementById("challenge-create-friends-empty");
const ccErrorEl = document.getElementById("challenge-create-error");
const ccSubmitBtn = document.getElementById("challenge-create-submit-btn");

let ccSport = "course";
let ccPreset = null;
let ccNatationDistance = null;
let ccNatationStroke = null;
let ccAllFriends = [];
let ccSelectedFriends = [];

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
  Object.keys(ccDurationDropdowns).forEach((unit) => ccPopulateDurationDropdown(unit));
});

// ---- Duration dropdowns: months (0-12), days (0-31), hours (0-24) picked
// at creation. The actual end timestamp only exists once the challenge
// activates (see challengeEndDate) - this just captures the raw components. ----
const ccDurationConfig = {
  months: { max: 12, singularKey: "challenges.unitMonth", pluralKey: "challenges.unitMonths" },
  days: { max: 31, singularKey: "challenges.unitDay", pluralKey: "challenges.unitDays" },
  hours: { max: 24, singularKey: "challenges.unitHour", pluralKey: "challenges.unitHours" },
};
const ccDurationDropdowns = {
  months: document.getElementById("challenge-create-months-select"),
  days: document.getElementById("challenge-create-days-select"),
  hours: document.getElementById("challenge-create-hours-select"),
};
let ccDuration = { months: 0, days: 1, hours: 0 };

function ccDurationOptionLabel(unit, value) {
  const cfg = ccDurationConfig[unit];
  return `${value} ${t(value === 1 ? cfg.singularKey : cfg.pluralKey)}`;
}

function ccUpdateDurationLabel(unit) {
  ccDurationDropdowns[unit].querySelector(".challenge-duration-label").textContent = ccDurationOptionLabel(unit, ccDuration[unit]);
}

function ccPopulateDurationDropdown(unit) {
  const dropdown = ccDurationDropdowns[unit];
  const menu = dropdown.querySelector(".sport-menu");
  menu.innerHTML = "";
  for (let i = 0; i <= ccDurationConfig[unit].max; i++) {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "sport-option";
    opt.classList.toggle("active", i === ccDuration[unit]);
    opt.textContent = ccDurationOptionLabel(unit, i);
    opt.addEventListener("click", () => {
      ccDuration[unit] = i;
      menu.querySelectorAll(".sport-option").forEach((o) => o.classList.toggle("active", o === opt));
      ccUpdateDurationLabel(unit);
      menu.hidden = true;
    });
    menu.appendChild(opt);
  }
  ccUpdateDurationLabel(unit);
}

Object.entries(ccDurationDropdowns).forEach(([unit, dropdown]) => {
  const btn = dropdown.querySelector(".sport-select-btn");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = dropdown.querySelector(".sport-menu");
    const opening = menu.hidden;
    window.closeAllDropdowns();
    menu.hidden = !opening;
  });
  ccPopulateDurationDropdown(unit);
});

document.addEventListener("click", (e) => {
  Object.values(ccDurationDropdowns).forEach((dropdown) => {
    const menu = dropdown.querySelector(".sport-menu");
    if (!menu.hidden && !dropdown.contains(e.target)) menu.hidden = true;
  });
});

function ccResetDuration() {
  ccDuration = { months: 0, days: 1, hours: 0 };
  Object.keys(ccDurationDropdowns).forEach((unit) => ccPopulateDurationDropdown(unit));
}

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

// ---- Invite modal: type >= 2 characters to get suggestions drawn from the
// user's own friend list (not a live server search - it's already a small,
// locally-held list from getMyFriends()). ----
const challengeInviteModal = document.getElementById("challenge-invite-modal");
const challengeInviteSearchInput = document.getElementById("challenge-invite-search-input");
const challengeInviteSuggestions = document.getElementById("challenge-invite-suggestions");
const challengeInviteEmpty = document.getElementById("challenge-invite-empty");
const challengeInviteCloseBtn = document.getElementById("challenge-invite-close-btn");
const challengeInviteSuggestionTemplate = document.getElementById("challenge-invite-suggestion-template");

function ccRenderInviteSuggestions() {
  const queryText = challengeInviteSearchInput.value.trim().toLowerCase();
  challengeInviteSuggestions.innerHTML = "";
  if (queryText.length < 2) {
    challengeInviteEmpty.classList.remove("visible");
    return;
  }
  const available = ccAllFriends.filter(
    (f) => !ccSelectedFriends.some((s) => s.uid === f.uid) && f.username.toLowerCase().includes(queryText)
  );
  challengeInviteEmpty.classList.toggle("visible", available.length === 0);
  available.forEach((friend) => {
    const node = challengeInviteSuggestionTemplate.content.cloneNode(true);
    node.querySelector(".friend-row-name").textContent = friend.username;
    node.querySelector(".challenge-invite-suggestion").addEventListener("click", () => {
      ccSelectedFriends.push(friend);
      challengeInviteSearchInput.value = "";
      challengeInviteSearchInput.focus();
      ccRenderInviteSuggestions();
      ccRenderSelectedFriendsList();
    });
    challengeInviteSuggestions.appendChild(node);
  });
}

challengeInviteSearchInput.addEventListener("input", ccRenderInviteSuggestions);

ccFriendAddBtn.addEventListener("click", () => {
  challengeInviteSearchInput.value = "";
  ccRenderInviteSuggestions();
  challengeInviteModal.hidden = false;
  challengeInviteSearchInput.focus();
});

challengeInviteCloseBtn.addEventListener("click", () => {
  challengeInviteModal.hidden = true;
});

function ccRenderSelectedFriendsList() {
  ccFriendsList.innerHTML = "";
  ccFriendAddBtn.hidden = ccAllFriends.length === 0;
  ccFriendsEmpty.classList.toggle("visible", ccAllFriends.length === 0);
  ccSelectedFriends.forEach((friend) => {
    const node = challengeFriendSelectedTemplate.content.cloneNode(true);
    node.querySelector(".friend-row-name").textContent = friend.username;
    node.querySelector(".friend-invite-remove-btn").addEventListener("click", () => {
      ccSelectedFriends = ccSelectedFriends.filter((f) => f.uid !== friend.uid);
      ccRenderInviteSuggestions();
      ccRenderSelectedFriendsList();
    });
    ccFriendsList.appendChild(node);
  });
}

// ---- "Classique" (existing sport/preset picker) vs "Personnalisable"
// (custom challenge, details to come) tabs, same swipeable pattern as the
// Mes défis / Invitations tabs above. ----
const ccModeTabBtns = Array.from(challengeCreateView.querySelectorAll(".friends-tab-btn"));
const ccModeTabViewport = document.getElementById("challenge-create-tab-viewport");
const ccModeTabTrack = document.getElementById("challenge-create-tab-track");
let ccActiveModeIndex = 0;

function setCcActiveMode(index) {
  ccActiveModeIndex = index;
  ccModeTabBtns.forEach((btn, i) => btn.classList.toggle("active", i === index));
  ccModeTabTrack.querySelectorAll(".friends-tab-page").forEach((page, i) => {
    page.hidden = i !== index;
  });
  clearFieldError(ccErrorEl);
}

ccModeTabBtns.forEach((btn, i) => {
  btn.addEventListener("click", () => setCcActiveMode(i));
});

let ccModeTouchStartX = 0;
let ccModeTouchStartY = 0;
ccModeTabViewport.addEventListener("touchstart", (e) => {
  ccModeTouchStartX = e.touches[0].clientX;
  ccModeTouchStartY = e.touches[0].clientY;
});
ccModeTabViewport.addEventListener("touchend", (e) => {
  const deltaX = e.changedTouches[0].clientX - ccModeTouchStartX;
  const deltaY = e.changedTouches[0].clientY - ccModeTouchStartY;
  if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
  if (deltaX < 0 && ccActiveModeIndex < ccModeTabBtns.length - 1) setCcActiveMode(ccActiveModeIndex + 1);
  else if (deltaX > 0 && ccActiveModeIndex > 0) setCcActiveMode(ccActiveModeIndex - 1);
});

async function openChallengeCreateView() {
  challengesViewEl.hidden = true;
  challengeCreateView.hidden = false;
  clearFieldError(ccErrorEl);
  setCcActiveMode(0);
  ccSelectSport("course");
  ccResetDuration();
  ccSelectedFriends = [];
  challengeInviteModal.hidden = true;
  ccAllFriends = await getMyFriends();
  ccRenderSelectedFriendsList();
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
  if (ccActiveModeIndex === 1) {
    showFieldError(ccErrorEl, "challenges.customComingSoon");
    return;
  }
  if (!ccPreset) {
    showFieldError(ccErrorEl, "challenges.errorNoPreset");
    return;
  }
  if (!ccDuration.months && !ccDuration.days && !ccDuration.hours) {
    showFieldError(ccErrorEl, "challenges.errorNoDuration");
    return;
  }
  const invitedUids = ccSelectedFriends.map((friend) => ({ uid: friend.uid, username: friend.username }));

  try {
    const challengeRef = doc(collection(db, "challenges"));
    const batch = writeBatch(db);
    batch.set(challengeRef, {
      creatorUid: uid,
      creatorUsername: username,
      sport: ccSport,
      presetKey: ccPreset,
      durationMonths: ccDuration.months,
      durationDays: ccDuration.days,
      durationHours: ccDuration.hours,
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
    .filter(Boolean);

  const myInvites = pendingChallenges
    .map((s, i) => (s.exists() ? { id: s.id, ...s.data() } : null))
    .filter(Boolean);

  renderMyChallenges(myChallenges);
  renderInvites(myInvites);
}

// Sort key = the challenge's end timestamp - still-waiting challenges have
// no activatedAt yet, so they sort first (soonest attention needed).
function challengeSortKey(challenge) {
  if (!challenge.activatedAt) return -Infinity;
  return challengeEndDate(challenge).getTime();
}

function appendChallengeRow(container, challenge) {
  const node = challengeRowTemplate.content.cloneNode(true);
  node.querySelector(".challenge-row-icon").innerHTML = sportIcon(challenge.sport);
  node.querySelector(".challenge-row-title").textContent = `${sportLabel(challenge.sport)} · ${presetDisplayLabel(challenge.sport, challenge.presetKey)}`;
  node.querySelector(".challenge-row-dates").textContent = challengeTimingLabel(challenge);
  node.querySelector(".challenge-row").addEventListener("click", () => openChallengeDetail(challenge));
  container.appendChild(node);
}

function renderMyChallenges(challenges) {
  const ongoing = challenges.filter((c) => !c.activatedAt || challengeIsActive(c)).sort((a, b) => challengeSortKey(a) - challengeSortKey(b));
  const ended = challenges.filter((c) => c.activatedAt && !challengeIsActive(c)).sort((a, b) => challengeSortKey(b) - challengeSortKey(a));

  challengesOngoingList.innerHTML = "";
  challengesOngoingEmpty.classList.toggle("visible", ongoing.length === 0);
  ongoing.forEach((challenge) => appendChallengeRow(challengesOngoingList, challenge));

  challengesEndedList.innerHTML = "";
  challengesEndedEmpty.classList.toggle("visible", ended.length === 0);
  ended.forEach((challenge) => appendChallengeRow(challengesEndedList, challenge));
}

function renderInvites(invites) {
  challengesInvitesList.innerHTML = "";
  challengesInvitesEmpty.classList.toggle("visible", invites.length === 0);
  invites.forEach((challenge) => {
    const node = challengeInviteTemplate.content.cloneNode(true);
    node.querySelector(".challenge-row-icon").innerHTML = sportIcon(challenge.sport);
    node.querySelector(".challenge-row-title").textContent = `${challenge.creatorUsername} · ${sportLabel(challenge.sport)} · ${presetDisplayLabel(challenge.sport, challenge.presetKey)}`;
    node.querySelector(".challenge-row-dates").textContent = formatChallengeDuration(challenge);

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
const challengeEndedOverlay = document.getElementById("challenge-ended-overlay");
const challengeEndedPodium = document.getElementById("challenge-ended-podium");

const challengeEntryFitnessFields = document.getElementById("challenge-entry-fitness-fields");
const challengeEntryFitnessInput = document.getElementById("challenge-entry-fitness-input");
const challengeEntryTimeFields = document.getElementById("challenge-entry-time-fields");
const challengeEntryHInput = document.getElementById("challenge-entry-h-input");
const challengeEntryMInput = document.getElementById("challenge-entry-m-input");
const challengeEntrySInput = document.getElementById("challenge-entry-s-input");
const challengeEntryCsInput = document.getElementById("challenge-entry-cs-input");
const challengeEntryTriathlonFields = document.getElementById("challenge-entry-triathlon-fields");
const challengeEntryTriLegInputs = {
  swim: {
    h: document.getElementById("challenge-entry-tri-swim-h"),
    m: document.getElementById("challenge-entry-tri-swim-m"),
    s: document.getElementById("challenge-entry-tri-swim-s"),
    cs: document.getElementById("challenge-entry-tri-swim-cs"),
  },
  bike: {
    h: document.getElementById("challenge-entry-tri-bike-h"),
    m: document.getElementById("challenge-entry-tri-bike-m"),
    s: document.getElementById("challenge-entry-tri-bike-s"),
    cs: document.getElementById("challenge-entry-tri-bike-cs"),
  },
  run: {
    h: document.getElementById("challenge-entry-tri-run-h"),
    m: document.getElementById("challenge-entry-tri-run-m"),
    s: document.getElementById("challenge-entry-tri-run-s"),
    cs: document.getElementById("challenge-entry-tri-run-cs"),
  },
};
const challengeEntrySubmitBtn = document.getElementById("challenge-entry-submit-btn");
const challengeEntryClosedMsg = document.getElementById("challenge-entry-closed-msg");

let currentChallenge = null;
let detailUnsubscribe = null;
let detailCountdownInterval = null;
let lastRankingRows = [];

function challengeIsActive(challenge) {
  if (!challenge.activatedAt) return false;
  const end = challengeEndDate(challenge);
  return Date.now() < end.getTime();
}

function secondsFromParts(h, m, s, cs) {
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0) + (Number(cs) || 0) / 100;
}

function fillTimeParts(inputs, totalSeconds) {
  const seconds = totalSeconds || 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds - Math.floor(seconds)) * 100);
  inputs.h.value = h || "";
  inputs.m.value = m || "";
  inputs.s.value = s || "";
  inputs.cs.value = cs || "";
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
  challengeEntryTriathlonFields.hidden = !active || challenge.sport !== "triathlon";
  challengeEntryTimeFields.hidden = !active || challenge.sport === "fitness" || challenge.sport === "triathlon";
  if (challenge.sport === "fitness") {
    const metric = window.SportData.FITNESS_METRIC[challenge.presetKey];
    challengeEntryFitnessInput.placeholder = metric === "weight" ? window.weightUnitLabel() : t("field.reps");
    challengeEntryFitnessInput.step = metric === "weight" ? "0.5" : "1";
  }
}

function fillChallengeEntryForm(challenge, row) {
  if (!row) return;
  if (challenge.sport === "fitness") {
    challengeEntryFitnessInput.value = row.value;
    return;
  }
  if (challenge.sport === "triathlon") {
    fillTimeParts(challengeEntryTriLegInputs.swim, row.swimSeconds);
    fillTimeParts(challengeEntryTriLegInputs.bike, row.bikeSeconds);
    fillTimeParts(challengeEntryTriLegInputs.run, row.runSeconds);
    return;
  }
  fillTimeParts(
    { h: challengeEntryHInput, m: challengeEntryMInput, s: challengeEntrySInput, cs: challengeEntryCsInput },
    row.value
  );
}

challengeEntrySubmitBtn.addEventListener("click", async () => {
  if (!currentChallenge || !challengeIsActive(currentChallenge)) return;
  const uid = myUid();
  const username = myUsername();
  if (!uid || !username) return;

  let value;
  const extra = {};
  if (currentChallenge.sport === "fitness") {
    value = Number(challengeEntryFitnessInput.value);
    if (!Number.isFinite(value) || challengeEntryFitnessInput.value === "") return;
  } else if (currentChallenge.sport === "triathlon") {
    const legs = challengeEntryTriLegInputs;
    extra.swimSeconds = secondsFromParts(legs.swim.h.value, legs.swim.m.value, legs.swim.s.value, legs.swim.cs.value);
    extra.bikeSeconds = secondsFromParts(legs.bike.h.value, legs.bike.m.value, legs.bike.s.value, legs.bike.cs.value);
    extra.runSeconds = secondsFromParts(legs.run.h.value, legs.run.m.value, legs.run.s.value, legs.run.cs.value);
    value = extra.swimSeconds + extra.bikeSeconds + extra.runSeconds;
    if (value <= 0) return;
  } else {
    value = secondsFromParts(
      challengeEntryHInput.value,
      challengeEntryMInput.value,
      challengeEntrySInput.value,
      challengeEntryCsInput.value
    );
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
      ...extra,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(error);
  }
});

new MutationObserver(() => {
  if (challengeDetailView.hidden) {
    if (detailUnsubscribe) {
      detailUnsubscribe();
      detailUnsubscribe = null;
    }
    if (detailCountdownInterval) {
      clearInterval(detailCountdownInterval);
      detailCountdownInterval = null;
    }
  }
}).observe(challengeDetailView, { attributes: true, attributeFilter: ["hidden"] });

// Once a challenge is over, an overlay covers the ranking/entry/leave area
// entirely (see .challenge-ended-overlay) - viewing the final podium is all
// there is left to do, so only the header's back arrow still works.
function updateEndedOverlay(challenge) {
  const ended = !challengeIsActive(challenge);
  challengeEndedOverlay.hidden = !ended;
  if (!ended) return;
  const uid = myUid();
  challengeEndedPodium.innerHTML = "";
  lastRankingRows.slice(0, 3).forEach((row, index) => {
    const node = challengeRankingRowTemplate.content.cloneNode(true);
    const card = node.querySelector(".exercise-card");
    card.classList.add("challenge-ended-podium-row");
    card.classList.remove("exercise-card");
    const rankEl = node.querySelector(".classement-rank");
    rankEl.textContent = String(index + 1);
    rankEl.classList.toggle("rank-gold", index === 0);
    rankEl.classList.toggle("rank-silver", index === 1);
    rankEl.classList.toggle("rank-bronze", index === 2);
    const nameEl = node.querySelector(".classement-name");
    nameEl.classList.add("challenge-ended-podium-name");
    nameEl.classList.remove("classement-name");
    nameEl.textContent = row.uid === uid ? `${row.username} ${t("classement.you")}` : row.username;
    node.querySelector(".classement-time").textContent = formatChallengeValue(challenge.sport, challenge.presetKey, row.value);
    challengeEndedPodium.appendChild(node);
  });
}

function openChallengeDetail(challenge) {
  currentChallenge = challenge;
  challengesViewEl.hidden = true;
  challengeDetailView.hidden = false;
  challengeDetailTitle.textContent = `${sportLabel(challenge.sport)} · ${presetDisplayLabel(challenge.sport, challenge.presetKey)}`;
  setupChallengeEntryForm(challenge);

  challengeDetailDates.textContent = challengeTimingLabel(challenge);
  updateEndedOverlay(challenge);
  if (detailCountdownInterval) clearInterval(detailCountdownInterval);
  detailCountdownInterval = setInterval(() => {
    challengeDetailDates.textContent = challengeTimingLabel(challenge);
    setupChallengeEntryForm(challenge);
    updateEndedOverlay(challenge);
  }, 1000);

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
  if (myRow) fillChallengeEntryForm(challenge, myRow);
  const sorted = [...rows].sort((a, b) =>
    challenge.sport === "fitness" ? b.value - a.value : a.value - b.value
  );
  lastRankingRows = sorted;
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
  updateEndedOverlay(challenge);
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
// Reused by notifications.js to build "challenge ended/ending soon" labels
// in the viewer's own language, without duplicating this lookup logic.
window.sportLabel = sportLabel;
window.presetDisplayLabel = presetDisplayLabel;

document.querySelector('.bottom-nav-btn[data-view="challenges"]').addEventListener("click", () => {
  setChallengesActiveTab(0);
  refreshChallengesData();
});

// Any bottom-nav switch (including re-tapping "Défis") must close these
// sub-pages - they aren't part of NAV_VIEWS (timer.js's showView only
// toggles the 5 top-level views), so without this they'd stay visible,
// stacked underneath whichever main view showView() switches to.
document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    challengeCreateView.hidden = true;
    challengeDetailView.hidden = true;
    challengeInviteModal.hidden = true;
  });
});

ccUpdateSportLabel();
