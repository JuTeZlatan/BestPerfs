import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQecXfxS-tFFB9EH8-Gy-5OM-g5byu_gA",
  authDomain: "best-perfs.firebaseapp.com",
  projectId: "best-perfs",
  storageBucket: "best-perfs.firebasestorage.app",
  messagingSenderId: "877329241895",
  appId: "1:877329241895:web:bfefa68d67694b0cbf7b02",
  measurementId: "G-Q41KBC2PKJ",
};

const app = initializeApp(firebaseConfig);

// On native (Capacitor Android/iOS), Google Sign-In happens through the native
// SDK via @capacitor-firebase/authentication, then gets bridged into the JS
// SDK below - indexedDBLocalPersistence is what that bridge needs to persist.
export const isNativePlatform = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();

export const auth = isNativePlatform
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
};
