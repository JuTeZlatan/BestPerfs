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
const usernameViewEl = document.getElementById("username-view");
const usernameForm = document.getElementById("username-form");
const usernameInput = document.getElementById("username-input");
const usernameErrorEl = document.getElementById("username-error");

const profileAccountRow = document.getElementById("profile-account-row");
const profileViewForAccount = document.getElementById("profile-view");
const accountViewEl = document.getElementById("account-view");
const accountBackBtn = document.getElementById("account-back-btn");
const accountUsernameDisplay = document.getElementById("account-username-display");
const accountEmailDisplay = document.getElementById("account-email-display");
const accountLogoutBtn = document.getElementById("account-logout-btn");

const gateGoogleBtn = document.getElementById("gate-google-btn");
const gateAuthForm = document.getElementById("gate-auth-form");
const gateEmailInput = document.getElementById("gate-email-input");
const gatePasswordInput = document.getElementById("gate-password-input");
const gateSignupBtn = document.getElementById("gate-signup-btn");
const gateErrorEl = document.getElementById("gate-error");

const signupViewEl = document.getElementById("signup-view");
const signupBackBtn = document.getElementById("signup-back-btn");
const signupForm = document.getElementById("signup-form");
const signupEmailInput = document.getElementById("signup-email-input");
const signupPasswordInput = document.getElementById("signup-password-input");
const signupErrorEl = document.getElementById("signup-error");

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

const AUTH_ERROR_KEYS = {
  "auth/email-already-in-use": "auth.errorEmailInUse",
  "auth/weak-password": "auth.errorWeakPassword",
  "auth/invalid-email": "auth.errorInvalidEmail",
  "auth/user-not-found": "auth.errorWrongCredentials",
  "auth/wrong-password": "auth.errorWrongCredentials",
  "auth/invalid-credential": "auth.errorWrongCredentials",
};

function showFieldError(el, error) {
  const key = AUTH_ERROR_KEYS[error?.code] || "auth.errorGeneric";
  el.textContent = t(key);
  el.hidden = false;
}

function clearFieldError(el) {
  el.hidden = true;
  el.textContent = "";
}

function showGateError(error) {
  showFieldError(gateErrorEl, error);
}

function clearGateError() {
  clearFieldError(gateErrorEl);
}

function isPasswordValid(password) {
  return (
    password.length >= 6 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

gateGoogleBtn.addEventListener("click", async () => {
  clearGateError();
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error?.code !== "auth/popup-closed-by-user") showGateError(error);
  }
});

gateSignupBtn.addEventListener("click", () => {
  authGateEl.hidden = true;
  signupViewEl.hidden = false;
  clearFieldError(signupErrorEl);
});

signupBackBtn.addEventListener("click", () => {
  signupViewEl.hidden = true;
  authGateEl.hidden = false;
  signupForm.reset();
  clearFieldError(signupErrorEl);
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFieldError(signupErrorEl);
  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value;
  if (!isPasswordValid(password)) {
    signupErrorEl.textContent = t("auth.errorPasswordRules");
    signupErrorEl.hidden = false;
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showFieldError(signupErrorEl, error);
  }
});

gateAuthForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearGateError();
  const email = gateEmailInput.value.trim();
  const password = gatePasswordInput.value;
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
  signupViewEl.hidden = true;
  usernameViewEl.hidden = true;
  appRootEl.hidden = false;
}

function showGate() {
  appRootEl.hidden = true;
  signupViewEl.hidden = true;
  usernameViewEl.hidden = true;
  authGateEl.hidden = false;
  gateAuthForm.reset();
  signupForm.reset();
  clearGateError();
  clearFieldError(signupErrorEl);
}

function showUsernamePrompt() {
  authGateEl.hidden = true;
  signupViewEl.hidden = true;
  appRootEl.hidden = true;
  usernameViewEl.hidden = false;
}

usernameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = usernameInput.value.trim();
  if (!value || !currentUid) return;
  try {
    await setDoc(doc(db, "users", currentUid), { username: value }, { merge: true });
  } catch {
    usernameErrorEl.textContent = t("auth.errorGeneric");
    usernameErrorEl.hidden = false;
    return;
  }
  accountUsernameDisplay.textContent = value;
  usernameForm.reset();
  showApp();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUid = null;
    accountUsernameDisplay.textContent = "";
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

  currentUid = user.uid;

  if (snap.exists()) {
    const data = snap.data();

    if (!data.username) {
      showUsernamePrompt();
      return;
    }

    accountUsernameDisplay.textContent = data.username;

    const wasAlreadyInApp = !appRootEl.hidden;
    let anyDiff = false;
    SYNCED_KEYS.forEach((key) => {
      const field = KEY_TO_FIELD[key];
      if (data[field] === undefined) return;
      if (localStorage.getItem(key) !== data[field]) anyDiff = true;
      nativeSetItem(key, data[field]);
    });
    if (anyDiff && wasAlreadyInApp) {
      // Data changed while already inside the app (e.g. signed in elsewhere) - reload to pick it up.
      location.reload();
    } else {
      showApp();
    }
  } else {
    const payload = { updatedAt: serverTimestamp() };
    SYNCED_KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) payload[KEY_TO_FIELD[key]] = value;
    });
    setDoc(userDocRef, payload, { merge: true }).catch(() => {});
    showUsernamePrompt();
  }
});
