# Règles Firestore complètes — à coller dans Firebase Console

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /usernames/{lowerUsername} {
      allow read: if request.auth != null;

      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.uid
        && request.resource.data.username is string
        && request.resource.data.username.lower() == lowerUsername
        && request.resource.data.keys().hasOnly(['uid', 'username']);
    }

    match /friendRequests/{requestId} {
      allow read: if request.auth != null
        && (resource == null || resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid);

      allow create: if request.auth != null
        && request.resource.data.fromUid == request.auth.uid
        && request.resource.data.toUid != request.auth.uid
        && request.resource.data.status == "pending"
        && request.resource.data.keys().hasOnly(
             ['fromUid', 'toUid', 'fromUsername', 'toUsername', 'status', 'createdAt'])
        && requestId == (
             request.resource.data.fromUid < request.resource.data.toUid
               ? request.resource.data.fromUid + "_" + request.resource.data.toUid
               : request.resource.data.toUid + "_" + request.resource.data.fromUid)
        && get(/databases/$(database)/documents/users/$(request.resource.data.fromUid)).data.username
             == request.resource.data.fromUsername
        && get(/databases/$(database)/documents/users/$(request.resource.data.toUid)).data.username
             == request.resource.data.toUsername;

      allow update: if request.auth != null
        && request.auth.uid == resource.data.toUid
        && resource.data.status == "pending"
        && request.resource.data.status == "accepted"
        && request.resource.data.fromUid == resource.data.fromUid
        && request.resource.data.toUid == resource.data.toUid
        && request.resource.data.fromUsername == resource.data.fromUsername
        && request.resource.data.toUsername == resource.data.toUsername
        && request.resource.data.keys().hasOnly(
             ['fromUid', 'toUid', 'fromUsername', 'toUsername', 'status', 'createdAt']);

      allow delete: if request.auth != null
        && (resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid);
    }

    function isFriend(otherUid) {
      let pid = request.auth.uid < otherUid
        ? request.auth.uid + '_' + otherUid
        : otherUid + '_' + request.auth.uid;
      return exists(/databases/$(database)/documents/friendRequests/$(pid))
        && get(/databases/$(database)/documents/friendRequests/$(pid)).data.status == 'accepted';
    }

    match /leaderboardEntries/{entryId} {
      allow read: if request.auth != null
        && (resource.data.uid == request.auth.uid || isFriend(resource.data.uid));

      allow create, update: if request.auth != null
        && request.auth.uid == request.resource.data.uid
        && request.resource.data.sport in ['course', 'natation', 'triathlon', 'velo', 'fitness']
        && request.resource.data.presetKey is string
        && request.resource.data.totalSeconds is number
        && request.resource.data.totalSeconds > 0
        && request.resource.data.username is string
        && entryId == request.resource.data.uid + '_' + request.resource.data.sport + '_' + request.resource.data.presetKey
        && request.resource.data.keys().hasOnly(['uid', 'username', 'sport', 'presetKey', 'totalSeconds', 'updatedAt']);

      allow delete: if request.auth != null && request.auth.uid == resource.data.uid;
    }

    match /notifications/{notifId} {
      allow read: if request.auth != null && resource.data.uid == request.auth.uid;
      allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
      // Pas de create/update côté client : seules les Cloud Functions (SDK Admin,
      // qui contourne ces règles) créent des notifications.
    }
  }
}
```

## Où coller

Firebase Console → projet **best-perfs** → Firestore Database → onglet **Rules** → remplacer tout le contenu par ce qui précède → **Publish**.
