# Règles Firebase Storage — à coller dans Firebase Console

Nécessaire pour la fonctionnalité "Preuves" (photos attachées aux stats, mode Cloud). Si le produit **Storage** n'est pas encore activé sur le projet `best-perfs`, active-le d'abord (Firebase Console → Storage → Get started), puis colle ces règles.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /proofs/{uid}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
      allow delete: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Note : la lecture est ouverte à tout utilisateur connecté (pas de vérification "ami" ici — les règles Storage n'ont pas d'accès pratique à Firestore pour vérifier ça). La vraie protection est en amont : seules les `photoUrls` d'un ami sont exposées via `leaderboardEntries`, qui lui est déjà protégé par la relation d'amitié. Sans connaître l'URL exacte (générée avec un token aléatoire par Firebase), personne ne peut deviner le chemin d'une photo.

## Où coller

Firebase Console → projet **best-perfs** → Storage → onglet **Rules** → remplacer tout le contenu par ce qui précède → **Publish**.
