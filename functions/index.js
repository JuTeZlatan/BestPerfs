const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
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

// A challenge's countdown only starts once every invited participant has
// responded (accepted or declined - a decline doesn't block the others,
// see account of the decision in challenges.js). A challenge with no
// invites at all activates as soon as the creator's own accepted doc is
// written. Firestore rules can't express "check every sibling doc for this
// challengeId", so activation happens here with admin access instead -
// challenges/{id} stays update:false for clients (see firestore.rules).
exports.onChallengeParticipantWrite = onDocumentWritten("challengeParticipants/{participantId}", async (event) => {
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after) return;
  const challengeRef = db.doc(`challenges/${after.challengeId}`);
  const challengeSnap = await challengeRef.get();
  if (!challengeSnap.exists || challengeSnap.data().activatedAt) return;
  const participantsSnap = await db.collection("challengeParticipants").where("challengeId", "==", after.challengeId).get();
  if (participantsSnap.empty) return;
  const allResolved = participantsSnap.docs.every((d) => d.data().status !== "pending");
  if (allResolved) {
    await challengeRef.update({ activatedAt: FieldValue.serverTimestamp() });
  }
});

// ---- Challenge deadline reminders: ended + ending-soon, both driven off the
// same calendar-correct end-date math as challengeEndDate() in challenges.js.
// A single scheduled sweep handles both so each challenge doc is only read
// once per run. ----
const FR_SPORT_LABELS = { course: "course à pied", natation: "natation", velo: "vélo", triathlon: "triathlon", fitness: "fitness" };

function frPresetLabel(sport, presetKey) {
  if (sport === "natation") return `${presetKey.split("-")[0]} m`;
  if (sport === "course" && presetKey === "half") return "semi-marathon";
  if (sport === "course" && presetKey === "marathon") return "marathon";
  if (sport === "course") return Number(presetKey) >= 1 ? `${presetKey} km` : `${Number(presetKey) * 1000} m`;
  if (sport === "velo") return `${presetKey} km`;
  return presetKey;
}

function frChallengeLabel(sport, presetKey) {
  return `${FR_SPORT_LABELS[sport] || sport} · ${frPresetLabel(sport, presetKey)}`;
}

function challengeEndDate(challenge) {
  const end = challenge.activatedAt.toDate();
  end.setMonth(end.getMonth() + (challenge.durationMonths || 0));
  end.setDate(end.getDate() + (challenge.durationDays || 0));
  end.setHours(end.getHours() + (challenge.durationHours || 0));
  return end;
}

async function notifyAcceptedParticipants(challengeId, type, title, body, sport, presetKey) {
  const participantsSnap = await db
    .collection("challengeParticipants")
    .where("challengeId", "==", challengeId)
    .where("status", "==", "accepted")
    .get();
  await Promise.all(
    participantsSnap.docs.map((p) =>
      Promise.all([
        sendToUser(p.data().uid, title, body),
        db.collection("notifications").add({
          uid: p.data().uid,
          type,
          sport,
          presetKey,
          createdAt: FieldValue.serverTimestamp(),
        }),
      ])
    )
  );
}

const ENDING_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;
// Guards against a flood of stale notifications the first time this sweep
// runs (or after any gap) finding challenges that ended long ago - those get
// silently marked as handled instead of "just" being announced.
const RECENTLY_ENDED_WINDOW_MS = 60 * 60 * 1000;

exports.checkChallengeDeadlines = onSchedule({ schedule: "every 15 minutes", region: "europe-west9" }, async () => {
  const now = Date.now();
  // A range filter (rather than "!=") reliably excludes challenges that
  // never got an activatedAt at all (still waiting on invitees), since
  // Firestore range queries skip documents missing the compared field.
  const activeSnap = await db.collection("challenges").where("activatedAt", ">", Timestamp.fromMillis(0)).get();

  await Promise.all(
    activeSnap.docs.map(async (challengeDoc) => {
      const challenge = challengeDoc.data();
      const end = challengeEndDate(challenge);
      const label = frChallengeLabel(challenge.sport, challenge.presetKey);

      if (!challenge.endedNotifiedAt && now >= end.getTime()) {
        const justEnded = now - end.getTime() <= RECENTLY_ENDED_WINDOW_MS;
        await Promise.all([
          justEnded
            ? notifyAcceptedParticipants(
                challengeDoc.id,
                "challenge_ended",
                "Best Perfs",
                `Ton défi ${label} est terminé, viens voir le podium !`,
                challenge.sport,
                challenge.presetKey
              )
            : Promise.resolve(),
          challengeDoc.ref.update({ endedNotifiedAt: FieldValue.serverTimestamp() }),
        ]);
        return;
      }

      if (!challenge.endingSoonNotifiedAt && end.getTime() - now > 0 && end.getTime() - now <= ENDING_SOON_WINDOW_MS) {
        await Promise.all([
          notifyAcceptedParticipants(
            challengeDoc.id,
            "challenge_ending_soon",
            "Best Perfs",
            `Ton défi ${label} se termine bientôt, enregistre ta perf !`,
            challenge.sport,
            challenge.presetKey
          ),
          challengeDoc.ref.update({ endingSoonNotifiedAt: FieldValue.serverTimestamp() }),
        ]);
      }
    })
  );
});

// ---- "Overtaken" alert: whenever someone's leaderboard entry improves,
// check their accepted friends' entries in that same sport+preset category -
// anyone this write newly ranks ahead of (and didn't already, before this
// write) gets notified. Fitness ranks reps/weight high-to-low; everything
// else ranks time low-to-high. ----
exports.onLeaderboardEntryWritten = onDocumentWritten("leaderboardEntries/{entryId}", async (event) => {
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!after) return; // deleted - nothing to announce
  const before = event.data.before.exists ? event.data.before.data() : null;

  const higherIsBetter = after.sport === "fitness";
  const newValue = after.totalSeconds;
  const oldValue = before ? before.totalSeconds : null;

  const [asFromSnap, asToSnap] = await Promise.all([
    db.collection("friendRequests").where("fromUid", "==", after.uid).where("status", "==", "accepted").get(),
    db.collection("friendRequests").where("toUid", "==", after.uid).where("status", "==", "accepted").get(),
  ]);
  const friendUids = [
    ...asFromSnap.docs.map((d) => d.data().toUid),
    ...asToSnap.docs.map((d) => d.data().fromUid),
  ];
  if (friendUids.length === 0) return;

  await Promise.all(
    friendUids.map(async (friendUid) => {
      const friendEntrySnap = await db.doc(`leaderboardEntries/${friendUid}_${after.sport}_${after.presetKey}`).get();
      if (!friendEntrySnap.exists) return;
      const friendValue = friendEntrySnap.data().totalSeconds;

      const nowBetter = higherIsBetter ? newValue > friendValue : newValue < friendValue;
      if (!nowBetter) return;
      const wasBetterBefore = oldValue != null && (higherIsBetter ? oldValue > friendValue : oldValue < friendValue);
      if (wasBetterBefore) return; // already ahead of this friend before this update

      const label = frChallengeLabel(after.sport, after.presetKey);
      await Promise.all([
        sendToUser(friendUid, "Best Perfs", `${after.username} vient de battre ton record en ${label}`),
        db.collection("notifications").add({
          uid: friendUid,
          type: "leaderboard_overtaken",
          fromUsername: after.username,
          sport: after.sport,
          presetKey: after.presetKey,
          createdAt: FieldValue.serverTimestamp(),
        }),
      ]);
    })
  );
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
