import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "./firebase-init.js";

const profileAccountRow = document.getElementById("profile-account-row");
const profileViewForAccount = document.getElementById("profile-view");
const accountViewEl = document.getElementById("account-view");
const accountBackBtn = document.getElementById("account-back-btn");
const accountGoogleBtn = document.getElementById("account-google-btn");
const accountSignedOutEl = document.getElementById("account-signed-out");
const accountSignedInEl = document.getElementById("account-signed-in");
const accountEmailDisplay = document.getElementById("account-email-display");
const accountLogoutBtn = document.getElementById("account-logout-btn");
const accountTabLogin = document.getElementById("account-tab-login");
const accountTabSignup = document.getElementById("account-tab-signup");
const accountLoginForm = document.getElementById("account-login-form");
const accountSignupForm = document.getElementById("account-signup-form");
const loginEmailInput = document.getElementById("login-email-input");
const loginPasswordInput = document.getElementById("login-password-input");
const signupEmailInput = document.getElementById("signup-email-input");
const signupPasswordInput = document.getElementById("signup-password-input");
const signupConfirmInput = document.getElementById("signup-confirm-input");
const authErrorEl = document.getElementById("auth-error");

profileAccountRow.addEventListener("click", () => {
  profileViewForAccount.hidden = true;
  accountViewEl.hidden = false;
  clearAuthError();
});

accountBackBtn.addEventListener("click", () => {
  accountViewEl.hidden = true;
  profileViewForAccount.hidden = false;
});

document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    accountViewEl.hidden = true;
  });
});

// Google OAuth popups are blocked inside embedded WebViews (Capacitor Android),
// so hide that option there until the native Google Sign-In plugin is wired up.
const isNativePlatform = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
if (isNativePlatform) accountGoogleBtn.hidden = true;

accountTabLogin.addEventListener("click", () => {
  accountTabLogin.classList.add("active");
  accountTabSignup.classList.remove("active");
  accountLoginForm.hidden = false;
  accountSignupForm.hidden = true;
  clearAuthError();
});

accountTabSignup.addEventListener("click", () => {
  accountTabSignup.classList.add("active");
  accountTabLogin.classList.remove("active");
  accountSignupForm.hidden = false;
  accountLoginForm.hidden = true;
  clearAuthError();
});

const AUTH_ERROR_KEYS = {
  "auth/email-already-in-use": "auth.errorEmailInUse",
  "auth/weak-password": "auth.errorWeakPassword",
  "auth/invalid-email": "auth.errorInvalidEmail",
  "auth/user-not-found": "auth.errorWrongCredentials",
  "auth/wrong-password": "auth.errorWrongCredentials",
  "auth/invalid-credential": "auth.errorWrongCredentials",
};

function showAuthError(error) {
  const key = AUTH_ERROR_KEYS[error?.code] || "auth.errorGeneric";
  authErrorEl.textContent = t(key);
  authErrorEl.hidden = false;
}

function clearAuthError() {
  authErrorEl.hidden = true;
  authErrorEl.textContent = "";
}

accountGoogleBtn.addEventListener("click", async () => {
  clearAuthError();
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error?.code !== "auth/popup-closed-by-user") showAuthError(error);
  }
});

accountSignupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAuthError();
  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value;
  if (password !== signupConfirmInput.value) {
    authErrorEl.textContent = t("auth.errorPasswordMismatch");
    authErrorEl.hidden = false;
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showAuthError(error);
  }
});

accountLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAuthError();
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showAuthError(error);
  }
});

accountLogoutBtn.addEventListener("click", () => {
  signOut(auth);
});

// ---- Cloud data sync ----
const SYNCED_KEYS = ["exercise-tracker-data", "exercise-tracker-presets", "exercise-tracker-sports"];
const KEY_TO_FIELD = {
  "exercise-tracker-data": "exerciseData",
  "exercise-tracker-presets": "presetsData",
  "exercise-tracker-sports": "sportsData",
};

let currentUid = null;

const nativeSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key, value) {
  nativeSetItem(key, value);
  if (currentUid && SYNCED_KEYS.includes(key)) {
    setDoc(doc(db, "users", currentUid), { [KEY_TO_FIELD[key]]: value, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUid = null;
    accountSignedOutEl.hidden = false;
    accountSignedInEl.hidden = true;
    accountEmailDisplay.textContent = "";
    return;
  }

  accountSignedOutEl.hidden = true;
  accountSignedInEl.hidden = false;
  accountEmailDisplay.textContent = user.email || "";

  const userDocRef = doc(db, "users", user.uid);
  let snap;
  try {
    snap = await getDoc(userDocRef);
  } catch {
    currentUid = user.uid;
    return;
  }

  if (snap.exists()) {
    const data = snap.data();
    let anyDiff = false;
    SYNCED_KEYS.forEach((key) => {
      const field = KEY_TO_FIELD[key];
      if (data[field] === undefined) return;
      if (localStorage.getItem(key) !== data[field]) anyDiff = true;
      nativeSetItem(key, data[field]);
    });
    currentUid = user.uid;
    if (anyDiff) location.reload();
  } else {
    currentUid = user.uid;
    const payload = { updatedAt: serverTimestamp() };
    SYNCED_KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) payload[KEY_TO_FIELD[key]] = value;
    });
    setDoc(userDocRef, payload, { merge: true }).catch(() => {});
  }
});
