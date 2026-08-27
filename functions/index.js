const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

async function sendToUser(uid, title, body) {
  const userSnap = await db.doc(`users/${uid}`).get();
  const tokens = userSnap.exists ? userSnap.data().fcmTokens || [] : [];
  if (tokens.length === 0) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    android: { notification: { sound: "default" } },
  });

  const staleTokens = [];
  response.responses.forEach((result, i) => {
    if (!result.success) {
      const code = result.error && result.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument") {
        staleTokens.push(tokens[i]);
      }
    }
  });
  if (staleTokens.length > 0) {
    await db.doc(`users/${uid}`).update({
      fcmTokens: tokens.filter((t) => !staleTokens.includes(t)),
    });
  }
}

// New friend request received.
exports.onFriendRequestCreated = onDocumentCreated("friendRequests/{requestId}", async (event) => {
  const data = event.data.data();
  if (data.status !== "pending") return;
  await Promise.all([
    sendToUser(data.toUid, "Best Perfs", `${data.fromUsername} veut devenir ton ami`),
    db.collection("notifications").add({
      uid: data.toUid,
      type: "friend_request",
      fromUsername: data.fromUsername,
      createdAt: FieldValue.serverTimestamp(),
    }),
  ]);
});

// Friend request accepted.
exports.onFriendRequestAccepted = onDocumentUpdated("friendRequests/{requestId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status !== "pending" || after.status !== "accepted") return;
  await Promise.all([
    sendToUser(after.fromUid, "Best Perfs", `${after.toUsername} a accepté ta demande d'ami`),
    db.collection("notifications").add({
      uid: after.fromUid,
      type: "friend_accepted",
      fromUsername: after.toUsername,
      createdAt: FieldValue.serverTimestamp(),
    }),
  ]);
});
