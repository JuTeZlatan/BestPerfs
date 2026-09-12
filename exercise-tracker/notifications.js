import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from "./firebase-init.js";

const notifIconBtn = document.getElementById("notif-icon-btn");
const notifBadge = document.getElementById("notif-badge");
const notifMenu = document.getElementById("notif-menu");
const notifList = document.getElementById("notif-list");
const notifEmpty = document.getElementById("notif-empty");
const notifRowTemplate = document.getElementById("notif-row-template");

const NOTIF_TEXT_KEYS = {
  friend_request: "notifications.friendRequest",
  friend_accepted: "notifications.friendAccepted",
  challenge_invite: "notifications.challengeInvite",
  challenge_accepted: "notifications.challengeAccepted",
  challenge_ended: "notifications.challengeEnded",
  challenge_ending_soon: "notifications.challengeEndingSoon",
  leaderboard_overtaken: "notifications.leaderboardOvertaken",
};

// Raw sport keys (as stored on the notification doc) -> this app's own
// sport.* i18n keys, so the {sport} placeholder renders in the viewer's own
// language rather than whatever the Cloud Function hardcoded.
const SPORT_I18N_KEYS = {
  course: "sport.running",
  natation: "sport.swimming",
  velo: "sport.cycling",
  triathlon: "sport.triathlon",
  fitness: "sport.fitness",
};

// "Course à pied · 5 km" - built from window.sportLabel/presetDisplayLabel
// (challenges.js) rather than duplicating that lookup logic here.
function challengeLabelFor(notif) {
  if (!window.sportLabel || !window.presetDisplayLabel) return "";
  return `${window.sportLabel(notif.sport)} · ${window.presetDisplayLabel(notif.sport, notif.presetKey)}`;
}

function notifVars(notif) {
  if (notif.type === "challenge_ended" || notif.type === "challenge_ending_soon") {
    return { name: challengeLabelFor(notif) };
  }
  if (notif.type === "leaderboard_overtaken") {
    return { name: notif.fromUsername, sport: t(SPORT_I18N_KEYS[notif.sport]) };
  }
  return { name: notif.fromUsername };
}

let notifications = [];

async function fetchNotifications() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    notifications = [];
    return;
  }
  try {
    const snap = await getDocs(query(collection(db, "notifications"), where("uid", "==", uid)));
    notifications = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (error) {
    console.error(error);
    notifications = [];
  }
}

function updateBadge() {
  const count = notifications.length;
  notifBadge.hidden = count === 0;
  notifBadge.textContent = count > 99 ? "99+" : String(count);
}

function renderNotifList() {
  notifList.innerHTML = "";
  notifEmpty.classList.toggle("visible", notifications.length === 0);
  notifications.forEach((notif) => {
    const node = notifRowTemplate.content.cloneNode(true);
    const textKey = NOTIF_TEXT_KEYS[notif.type];
    node.querySelector(".notif-row-text").textContent = textKey ? t(textKey, notifVars(notif)) : "";
    node.querySelector(".notif-row-text").addEventListener("click", () => openNotification(notif));
    node.querySelector(".notif-row-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      removeNotification(notif.id);
    });
    notifList.appendChild(node);
  });
}

async function removeNotification(id) {
  notifications = notifications.filter((n) => n.id !== id);
  updateBadge();
  renderNotifList();
  try {
    await deleteDoc(doc(db, "notifications", id));
  } catch (error) {
    console.error(error);
  }
}

function openNotification(notif) {
  notifMenu.hidden = true;
  removeNotification(notif.id);
  if (notif.type === "friend_request") {
    window.showView("profile");
    window.openFriendsView(1);
  } else if (notif.type === "friend_accepted") {
    window.showView("profile");
    window.openFriendsView(0);
  } else if (notif.type === "challenge_invite") {
    window.openChallengesView && window.openChallengesView(1);
  } else if (notif.type === "challenge_accepted") {
    window.openChallengesView && window.openChallengesView(0);
  } else if (notif.type === "challenge_ended" || notif.type === "challenge_ending_soon") {
    window.openChallengesView && window.openChallengesView(0);
  } else if (notif.type === "leaderboard_overtaken") {
    window.showView && window.showView("classement");
  }
}

notifIconBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  const opening = notifMenu.hidden;
  window.closeAllDropdowns();
  notifMenu.hidden = !opening;
  if (opening) {
    await fetchNotifications();
    updateBadge();
    renderNotifList();
  }
});

document.addEventListener("click", (e) => {
  if (!notifMenu.hidden && !notifMenu.contains(e.target) && e.target !== notifIconBtn) {
    notifMenu.hidden = true;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !notifMenu.hidden) notifMenu.hidden = true;
});

document.addEventListener("languagechange", () => {
  if (!notifMenu.hidden) renderNotifList();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    notifications = [];
    updateBadge();
    return;
  }
  await fetchNotifications();
  updateBadge();
});
