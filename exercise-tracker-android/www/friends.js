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
  serverTimestamp,
} from "./firebase-init.js";

const profileFriendsRow = document.getElementById("profile-friends-row");
const profileViewForFriends = document.getElementById("profile-view");
const friendsViewEl = document.getElementById("friends-view");
const friendsBackBtn = document.getElementById("friends-back-btn");

const friendsAddToggleBtn = document.getElementById("friends-add-toggle");
const friendsAddModal = document.getElementById("friends-add-modal");
const friendsAddForm = document.getElementById("friends-add-form");
const friendsAddInput = document.getElementById("friends-add-input");
const friendsAddErrorEl = document.getElementById("friends-add-error");
const friendsAddCancelBtn = document.getElementById("friends-add-cancel-btn");

const friendsIncomingList = document.getElementById("friends-incoming-list");
const friendsIncomingEmpty = document.getElementById("friends-incoming-empty");
const friendsOutgoingList = document.getElementById("friends-outgoing-list");
const friendsOutgoingEmpty = document.getElementById("friends-outgoing-empty");
const friendsListEl = document.getElementById("friends-list");
const friendsListEmpty = document.getElementById("friends-list-empty");

const friendsTabBtns = Array.from(document.querySelectorAll(".friends-tab-btn"));
const friendsTabViewport = document.getElementById("friends-tab-viewport");
const friendsTabTrack = document.getElementById("friends-tab-track");
let activeTabIndex = 0;

function setActiveTab(index) {
  activeTabIndex = index;
  friendsTabBtns.forEach((btn, i) => btn.classList.toggle("active", i === index));
  friendsTabTrack.style.transform = `translateX(-${index * 100}%)`;
}

friendsTabBtns.forEach((btn, i) => {
  btn.addEventListener("click", () => setActiveTab(i));
});

let touchStartX = 0;
let touchStartY = 0;

friendsTabViewport.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
});

friendsTabViewport.addEventListener("touchend", (e) => {
  const deltaX = e.changedTouches[0].clientX - touchStartX;
  const deltaY = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
  if (deltaX < 0 && activeTabIndex < friendsTabBtns.length - 1) setActiveTab(activeTabIndex + 1);
  else if (deltaX > 0 && activeTabIndex > 0) setActiveTab(activeTabIndex - 1);
});

const friendIncomingTemplate = document.getElementById("friend-incoming-template");
const friendOutgoingTemplate = document.getElementById("friend-outgoing-template");
const friendTemplate = document.getElementById("friend-template");

function pairId(uidA, uidB) {
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

function myUsername() {
  return document.getElementById("account-username-display").textContent.trim();
}

function clearAddError() {
  friendsAddErrorEl.hidden = true;
  friendsAddErrorEl.textContent = "";
}

function showAddError(key) {
  friendsAddErrorEl.textContent = t(key);
  friendsAddErrorEl.hidden = false;
}

function closeAddForm() {
  friendsAddModal.hidden = true;
  friendsAddForm.reset();
  clearAddError();
}

friendsAddToggleBtn.addEventListener("click", () => {
  friendsAddModal.hidden = false;
  clearAddError();
  friendsAddInput.focus();
});

friendsAddCancelBtn.addEventListener("click", () => {
  closeAddForm();
});

function openFriendsView(tabIndex) {
  profileViewForFriends.hidden = true;
  friendsViewEl.hidden = false;
  closeAddForm();
  setActiveTab(tabIndex);
  refreshFriendsData();
}
window.openFriendsView = openFriendsView;

profileFriendsRow.addEventListener("click", () => openFriendsView(0));

friendsBackBtn.addEventListener("click", () => {
  friendsViewEl.hidden = true;
  profileViewForFriends.hidden = false;
});

document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    friendsViewEl.hidden = true;
  });
});

async function refreshFriendsData() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const requestsRef = collection(db, "friendRequests");
  const [incomingSnap, outgoingSnap, friendsAsFromSnap, friendsAsToSnap] = await Promise.all([
    getDocs(query(requestsRef, where("toUid", "==", uid), where("status", "==", "pending"))),
    getDocs(query(requestsRef, where("fromUid", "==", uid), where("status", "==", "pending"))),
    getDocs(query(requestsRef, where("fromUid", "==", uid), where("status", "==", "accepted"))),
    getDocs(query(requestsRef, where("toUid", "==", uid), where("status", "==", "accepted"))),
  ]).catch((error) => {
    console.error(error);
    return [];
  });

  if (!incomingSnap) return;

  const incoming = incomingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const outgoing = outgoingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  incoming.sort((a, b) => a.fromUsername.localeCompare(b.fromUsername));
  outgoing.sort((a, b) => a.toUsername.localeCompare(b.toUsername));
  renderIncoming(incoming);
  renderOutgoing(outgoing);
  const friends = [
    ...friendsAsFromSnap.docs.map((d) => ({ id: d.id, username: d.data().toUsername })),
    ...friendsAsToSnap.docs.map((d) => ({ id: d.id, username: d.data().fromUsername })),
  ];
  friends.sort((a, b) => a.username.localeCompare(b.username));
  renderFriends(friends);
}

function renderIncoming(requests) {
  friendsIncomingList.innerHTML = "";
  friendsIncomingEmpty.classList.toggle("visible", requests.length === 0);
  requests.forEach((request) => {
    const node = friendIncomingTemplate.content.cloneNode(true);
    node.querySelector(".friend-row-name").textContent = request.fromUsername;
    node.querySelector(".friend-accept-btn").textContent = t("friends.acceptBtn");
    node.querySelector(".friend-decline-btn").textContent = t("friends.declineBtn");

    node.querySelector(".friend-accept-btn").addEventListener("click", async () => {
      try {
        await updateDoc(doc(db, "friendRequests", request.id), { status: "accepted" });
      } catch (error) {
        console.error(error);
      }
      refreshFriendsData();
    });

    node.querySelector(".friend-decline-btn").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "friendRequests", request.id));
      } catch (error) {
        console.error(error);
      }
      refreshFriendsData();
    });

    friendsIncomingList.appendChild(node);
  });
}

function renderOutgoing(requests) {
  friendsOutgoingList.innerHTML = "";
  friendsOutgoingEmpty.classList.toggle("visible", requests.length === 0);
  requests.forEach((request) => {
    const node = friendOutgoingTemplate.content.cloneNode(true);
    node.querySelector(".friend-row-name").textContent = request.toUsername;
    node.querySelector(".friend-row-pending").textContent = t("friends.pendingLabel");
    node.querySelector(".friend-cancel-btn").textContent = t("friends.cancelBtn");

    node.querySelector(".friend-cancel-btn").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "friendRequests", request.id));
      } catch (error) {
        console.error(error);
      }
      refreshFriendsData();
    });

    friendsOutgoingList.appendChild(node);
  });
}

function renderFriends(friends) {
  friendsListEl.innerHTML = "";
  friendsListEmpty.classList.toggle("visible", friends.length === 0);
  friends.forEach((friend) => {
    const node = friendTemplate.content.cloneNode(true);
    node.querySelector(".friend-row-name").textContent = friend.username;
    node.querySelector(".friend-remove-btn").textContent = t("friends.removeBtn");

    node.querySelector(".friend-remove-btn").addEventListener("click", () => {
      window.openConfirmModal(t("friends.unfriendConfirm", { name: friend.username }), async () => {
        try {
          await deleteDoc(doc(db, "friendRequests", friend.id));
        } catch (error) {
          console.error(error);
        }
        refreshFriendsData();
      });
    });

    friendsListEl.appendChild(node);
  });
}

friendsAddForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAddError();
  const myUid = auth.currentUser?.uid;
  const typed = friendsAddInput.value.trim();
  if (!typed || !myUid) return;
  const lower = typed.toLowerCase();

  try {
    const mappingSnap = await getDoc(doc(db, "usernames", lower));
    if (!mappingSnap.exists()) {
      showAddError("friends.errorNotFound");
      return;
    }
    const targetUid = mappingSnap.data().uid;
    const targetUsername = mappingSnap.data().username;
    if (targetUid === myUid) {
      showAddError("friends.errorSelf");
      return;
    }

    const requestId = pairId(myUid, targetUid);
    const existingSnap = await getDoc(doc(db, "friendRequests", requestId));
    if (existingSnap.exists()) {
      showAddError(existingSnap.data().status === "accepted" ? "friends.errorAlreadyFriends" : "friends.errorAlreadyPending");
      return;
    }

    await setDoc(doc(db, "friendRequests", requestId), {
      fromUid: myUid,
      toUid: targetUid,
      fromUsername: myUsername(),
      toUsername: targetUsername,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    closeAddForm();
    refreshFriendsData();
  } catch (error) {
    console.error(error);
    showAddError("friends.errorGeneric");
  }
});

document.addEventListener("languagechange", () => {
  if (!friendsViewEl.hidden) refreshFriendsData();
});
