const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");

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

// New challenge invite received (skips the creator's own auto-accepted
// participant doc, created in the same batch - only real invites notify).
exports.onChallengeInviteCreated = onDocumentCreated("challengeParticipants/{participantId}", async (event) => {
  const data = event.data.data();
  if (data.status !== "pending" || data.uid === data.invitedBy) return;
  const inviterSnap = await db.doc(`users/${data.invitedBy}`).get();
  const inviterUsername = inviterSnap.exists ? inviterSnap.data().username : "";
  await Promise.all([
    sendToUser(data.uid, "Best Perfs", `${inviterUsername} te défie`),
    db.collection("notifications").add({
      uid: data.uid,
      type: "challenge_invite",
      fromUsername: inviterUsername,
      createdAt: FieldValue.serverTimestamp(),
    }),
  ]);
});

// Challenge invite accepted - notify the challenge's creator.
exports.onChallengeInviteAccepted = onDocumentUpdated("challengeParticipants/{participantId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status !== "pending" || after.status !== "accepted" || after.uid === after.invitedBy) return;
  await Promise.all([
    sendToUser(after.invitedBy, "Best Perfs", `${after.username} a rejoint ton défi`),
    db.collection("notifications").add({
      uid: after.invitedBy,
      type: "challenge_accepted",
      fromUsername: after.username,
      createdAt: FieldValue.serverTimestamp(),
    }),
  ]);
});

// Deletes email/password signups that never clicked their confirmation link
// within 10 minutes of finishing signup (username + birthdate submitted -
// see account.js's usernameForm handler, which sets pendingEmailVerification
// on users/{uid}). Only ever touches accounts that actually went through
// that gate, never pre-existing accounts created before this feature shipped.
const VERIFICATION_WINDOW_MS = 10 * 60 * 1000;

exports.cleanupUnverifiedSignups = onSchedule({ schedule: "every 5 minutes", region: "europe-west9" }, async () => {
  const authAdmin = getAuth();
  const cutoff = Date.now() - VERIFICATION_WINDOW_MS;
  let pageToken;

  do {
    const page = await authAdmin.listUsers(1000, pageToken);
    const candidates = page.users.filter((user) => {
      if (user.emailVerified) return false;
      if (!user.providerData.some((p) => p.providerId === "password")) return false;
      return new Date(user.metadata.creationTime).getTime() < cutoff;
    });

    await Promise.all(
      candidates.map(async (user) => {
        const userSnap = await db.doc(`users/${user.uid}`).get();
        if (!userSnap.exists) return;
        const data = userSnap.data();
        if (data.pendingEmailVerification !== true) return;

        const batch = db.batch();
        batch.delete(db.doc(`users/${user.uid}`));
        if (data.username) batch.delete(db.doc(`usernames/${data.username.toLowerCase()}`));
        await batch.commit();
        await authAdmin.deleteUser(user.uid).catch(() => {});
      })
    );

    pageToken = page.pageToken;
  } while (pageToken);
});
