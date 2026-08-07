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

const appRootEl = document.getElementById("app-root");
const authGateEl = document.getElementById("auth-gate");

const profileAccountRow = document.getElementById("profile-account-row");
const profileViewForAccount = document.getElementById("profile-view");
const accountViewEl = document.getElementById("account-view");
const accountBackBtn = document.getElementById("account-back-btn");
const accountEmailDisplay = document.getElementById("account-email-display");
const accountLogoutBtn = document.getElementById("account-logout-btn");

const gateGoogleBtn = document.getElementById("gate-google-btn");
const gateTabLogin = document.getElementById("gate-tab-login");
const gateTabSignup = document.getElementById("gate-tab-signup");
const gateLoginForm = document.getElementById("gate-login-form");
const gateSignupForm = document.getElementById("gate-signup-form");
const gateLoginEmailInput = document.getElementById("gate-login-email-input");
const gateLoginPasswordInput = document.getElementById("gate-login-password-input");
const gateSignupEmailInput = document.getElementById("gate-signup-email-input");
const gateSignupPasswordInput = document.getElementById("gate-signup-password-input");
const gateSignupConfirmInput = document.getElementById("gate-signup-confirm-input");
const gateErrorEl = document.getElementById("gate-error");

profileAccountRow.addEventListener("click", () => {
  profileViewForAccount.hidden = true;
  accountViewEl.hidden = false;
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
if (isNativePlatform) gateGoogleBtn.hidden = true;

gateTabLogin.addEventListener("click", () => {
  gateTabLogin.classList.add("active");
  gateTabSignup.classList.remove("active");
  gateLoginForm.hidden = false;
  gateSignupForm.hidden = true;
  clearGateError();
});

gateTabSignup.addEventListener("click", () => {
  gateTabSignup.classList.add("active");
  gateTabLogin.classList.remove("active");
  gateSignupForm.hidden = false;
  gateLoginForm.hidden = true;
  clearGateError();
});

const AUTH_ERROR_KEYS = {
  "auth/email-already-in-use": "auth.errorEmailInUse",
  "auth/weak-password": "auth.errorWeakPassword",
  "auth/invalid-email": "auth.errorInvalidEmail",
  "auth/user-not-found": "auth.errorWrongCredentials",
  "auth/wrong-password": "auth.errorWrongCredentials",
  "auth/invalid-credential": "auth.errorWrongCredentials",
};

function showGateError(error) {
  const key = AUTH_ERROR_KEYS[error?.code] || "auth.errorGeneric";
  gateErrorEl.textContent = t(key);
  gateErrorEl.hidden = false;
}

function clearGateError() {
  gateErrorEl.hidden = true;
  gateErrorEl.textContent = "";
}

gateGoogleBtn.addEventListener("click", async () => {
  clearGateError();
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error?.code !== "auth/popup-closed-by-user") showGateError(error);
  }
});

gateSignupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearGateError();
  const email = gateSignupEmailInput.value.trim();
  const password = gateSignupPasswordInput.value;
  if (password !== gateSignupConfirmInput.value) {
    gateErrorEl.textContent = t("auth.errorPasswordMismatch");
    gateErrorEl.hidden = false;
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showGateError(error);
  }
});

gateLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearGateError();
  const email = gateLoginEmailInput.value.trim();
  const password = gateLoginPasswordInput.value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showGateError(error);
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

function showApp() {
  authGateEl.hidden = true;
  appRootEl.hidden = false;
}

function showGate() {
  appRootEl.hidden = true;
  authGateEl.hidden = false;
  gateLoginForm.reset();
  gateSignupForm.reset();
  clearGateError();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUid = null;
    accountEmailDisplay.textContent = "";
    showGate();
    return;
  }

  accountEmailDisplay.textContent = user.email || "";

  const userDocRef = doc(db, "users", user.uid);
  let snap;
  try {
    snap = await getDoc(userDocRef);
  } catch {
    currentUid = user.uid;
    showApp();
    return;
  }

  if (snap.exists()) {
    const wasAlreadyInApp = !appRootEl.hidden;
    const data = snap.data();
    let anyDiff = false;
    SYNCED_KEYS.forEach((key) => {
      const field = KEY_TO_FIELD[key];
      if (data[field] === undefined) return;
      if (localStorage.getItem(key) !== data[field]) anyDiff = true;
      nativeSetItem(key, data[field]);
    });
    currentUid = user.uid;
    if (anyDiff && wasAlreadyInApp) {
      // Data changed while already inside the app (e.g. signed in elsewhere) - reload to pick it up.
      location.reload();
    } else {
      showApp();
    }
  } else {
    currentUid = user.uid;
    const payload = { updatedAt: serverTimestamp() };
    SYNCED_KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) payload[KEY_TO_FIELD[key]] = value;
    });
    setDoc(userDocRef, payload, { merge: true }).catch(() => {});
    showApp();
  }
});
