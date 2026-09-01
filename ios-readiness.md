# Préparation iOS / App Store — état et reste à faire

## Ce qui est fait

- Projet iOS Capacitor généré avec succès : `exercise-tracker-android/ios/App/` (le nom du dossier racine du dépôt Capacitor n'a pas changé, mais il contient maintenant un projet Android **et** iOS côte à côte, partageant les mêmes fichiers web dans `www/`).
- `npx cap sync ios` fonctionne correctement depuis Windows — ce projet utilise Swift Package Manager (pas CocoaPods), donc pas de blocage macOS-only à cette étape-là.
- `Info.plist` (`exercise-tracker-android/ios/App/App/Info.plist`) contient déjà les descriptions d'usage obligatoires pour la caméra et la photothèque (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`) — sans ça, Apple rejette direct toute appli qui utilise la caméra.
- Les 8 plugins Capacitor déjà utilisés côté Android (Camera, App, Filesystem, LocalNotifications, Share, StatusBar, Firebase Auth, Firebase Messaging) sont bien détectés et intégrés côté iOS aussi.

## Ce qu'il reste à faire (nécessite un Mac + Xcode)

1. **Compiler et tester réellement l'appli** — ouvrir `exercise-tracker-android/ios/App/App.xcworkspace` (ou `.xcodeproj`) dans Xcode, résoudre les éventuels soucis de compilation propres à iOS (jamais testé jusqu'ici), lancer sur un simulateur puis un vrai iPhone.
2. **Ajouter l'appli iOS dans la console Firebase** (projet `best-perfs`) pour obtenir un fichier `GoogleService-Info.plist` à placer dans `ios/App/App/` — sans ça, Firebase Auth/Firestore/Storage/Messaging ne fonctionneront pas côté iOS (l'équivalent du `google-services.json` déjà utilisé côté Android).
3. **"Se connecter avec Apple"** — obligatoire dès qu'une appli propose un login social (ici Google Sign-In) pour passer la review Apple (règle 4.8 de l'App Store Review Guidelines). Nécessite :
   - Un compte Apple Developer Program actif (~99$/an).
   - Activer la capacité "Sign In with Apple" sur l'identifiant de l'appli dans le portail développeur Apple.
   - Ajouter le provider Apple dans Firebase Authentication (console) et implémenter le bouton côté appli (`@capacitor-firebase/authentication` le supporte déjà, il suffira de l'appeler comme Google Sign-In l'est déjà dans `account.js`).
4. **Icônes et écran de lancement iOS** — tailles et formats différents d'Android (`AppIcon.appiconset`, `LaunchScreen.storyboard` déjà générés vides/par défaut par Capacitor, à remplacer par les vrais visuels de l'appli).
5. **Compte Apple Developer Program** — à créer par l'utilisateur (paiement annuel, vérification d'identité) avant de pouvoir signer/soumettre quoi que ce soit.
6. **Signature et soumission** — certificats de distribution, profils de provisionnement, archivage et envoi via Xcode ou Transporter vers App Store Connect — tout ça se fait uniquement depuis un Mac.

## Non bloquant pour l'instant

- Rien de tout ça n'empêche de continuer à développer/tester la version Android en parallèle — les deux plateformes partagent le même code web (`www/`), donc chaque changement continue de profiter aux deux dès qu'un Mac sera disponible pour la partie iOS.
