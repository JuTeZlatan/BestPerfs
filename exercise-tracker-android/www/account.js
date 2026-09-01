import {
  auth,
  db,
  googleProvider,
  isNativePlatform,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  arrayUnion,
} from "./firebase-init.js";

const appRootEl = document.getElementById("app-root");
const authGateEl = document.getElementById("auth-gate");
const usernameViewEl = document.getElementById("username-view");
const usernameForm = document.getElementById("username-form");
const usernameInput = document.getElementById("username-input");
const usernameBirthdateInput = document.getElementById("username-birthdate-input");
const usernameErrorEl = document.getElementById("username-error");

const verifyEmailViewEl = document.getElementById("verify-email-view");
const verifyEmailHintEl = document.getElementById("verify-email-hint");
const verifyEmailContinueBtn = document.getElementById("verify-email-continue-btn");
const verifyEmailResendBtn = document.getElementById("verify-email-resend-btn");
const verifyEmailCancelBtn = document.getElementById("verify-email-cancel-btn");
const verifyEmailErrorEl = document.getElementById("verify-email-error");
const verifyEmailSuccessEl = document.getElementById("verify-email-success");

const profileAccountRow = document.getElementById("profile-account-row");
const profileViewForAccount = document.getElementById("profile-view");
const accountViewEl = document.getElementById("account-view");
const accountBackBtn = document.getElementById("account-back-btn");
const accountUsernameDisplay = document.getElementById("account-username-display");
const accountEmailDisplay = document.getElementById("account-email-display");
const accountBirthdateDisplay = document.getElementById("account-birthdate-display");
const accountLogoutBtn = document.getElementById("account-logout-btn");
const accountDeleteBtn = document.getElementById("account-delete-btn");
const accountDeleteErrorEl = document.getElementById("account-delete-error");

const gateGoogleBtn = document.getElementById("gate-google-btn");
const gateAuthForm = document.getElementById("gate-auth-form");
const gateEmailInput = document.getElementById("gate-email-input");
const gatePasswordInput = document.getElementById("gate-password-input");
const gateSignupBtn = document.getElementById("gate-signup-btn");
const gateErrorEl = document.getElementById("gate-error");
const gateForgotPasswordBtn = document.getElementById("gate-forgot-password-btn");

const forgotPasswordViewEl = document.getElementById("forgot-password-view");
const forgotPasswordBackBtn = document.getElementById("forgot-password-back-btn");
const forgotPasswordForm = document.getElementById("forgot-password-form");
const forgotPasswordEmailInput = document.getElementById("forgot-password-email-input");
const forgotPasswordErrorEl = document.getElementById("forgot-password-error");
const forgotPasswordSuccessEl = document.getElementById("forgot-password-success");

const signupViewEl = document.getElementById("signup-view");
const signupBackBtn = document.getElementById("signup-back-btn");
const signupForm = document.getElementById("signup-form");
const signupEmailInput = document.getElementById("signup-email-input");
const signupPasswordInput = document.getElementById("signup-password-input");
const signupErrorEl = document.getElementById("signup-error");

profileAccountRow.addEventListener("click", () => {
  profileViewForAccount.hidden = true;
  accountViewEl.hidden = false;
  clearFieldError(accountDeleteErrorEl);
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

const AUTH_ERROR_KEYS = {
  "auth/email-already-in-use": "auth.errorEmailInUse",
  "auth/weak-password": "auth.errorWeakPassword",
  "auth/invalid-email": "auth.errorInvalidEmail",
  "auth/user-not-found": "auth.errorWrongCredentials",
  "auth/wrong-password": "auth.errorWrongCredentials",
  "auth/invalid-credential": "auth.errorWrongCredentials",
  "auth/requires-recent-login": "auth.errorRequiresRecentLogin",
  "auth/too-many-requests": "auth.errorTooManyRequests",
  "auth/expired-signup": "auth.verifyEmailExpired",
};

function showFieldError(el, error) {
  console.error(error);
  const key = AUTH_ERROR_KEYS[error?.code] || "auth.errorGeneric";
  const detail = error?.code || error?.message || "";
  el.textContent = detail ? `${t(key)} (${detail})` : t(key);
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

function formatBirthdate(value) {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

// Backfill for accounts created before the usernames/{lower} lookup collection
// existed: claim the mapping on next sign-in if it's still missing. Best-effort,
// never blocks showApp() - a rare pre-existing case-insensitive collision just
// stays unfindable by friend search rather than breaking anything.
async function ensureUsernameMapping(uid, username) {
  if (!username) return;
  try {
    const mappingRef = doc(db, "usernames", username.toLowerCase());
    const mappingSnap = await getDoc(mappingRef);
    if (!mappingSnap.exists()) {
      await setDoc(mappingRef, { uid, username });
    }
  } catch (error) {
    console.warn("ensureUsernameMapping failed", error);
  }
}

// Registers this device for push notifications (friend requests, accepted
// requests - see functions/index.js) by saving its FCM token onto the user's
// doc. Native-only: there's no web push setup (VAPID key / messaging service
// worker) yet, so this is a no-op in the browser.
async function registerPushToken(uid) {
  if (!isNativePlatform) return;
  try {
    const permStatus = await Capacitor.Plugins.FirebaseMessaging.checkPermissions();
    let receive = permStatus.receive;
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      const requested = await Capacitor.Plugins.FirebaseMessaging.requestPermissions();
      receive = requested.receive;
    }
    if (receive !== "granted") return;
    const { token } = await Capacitor.Plugins.FirebaseMessaging.getToken();
    if (!token) return;
    await setDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) }, { merge: true });
  } catch (error) {
    console.warn("registerPushToken failed", error);
  }
}

gateGoogleBtn.addEventListener("click", async () => {
  clearGateError();
  try {
    if (isNativePlatform) {
      // Native Google Sign-In (Android/iOS) authenticates on the native layer;
      // bridge that into the JS SDK so auth/onAuthStateChanged/Firestore see it.
      const result = await Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle();
      const idToken = result?.credential?.idToken;
      if (!idToken) throw new Error("missing-id-token");
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } else {
      await signInWithPopup(auth, googleProvider);
    }
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

gateForgotPasswordBtn.addEventListener("click", () => {
  authGateEl.hidden = true;
  forgotPasswordViewEl.hidden = false;
  forgotPasswordForm.reset();
  clearFieldError(forgotPasswordErrorEl);
  forgotPasswordSuccessEl.hidden = true;
});

forgotPasswordBackBtn.addEventListener("click", () => {
  forgotPasswordViewEl.hidden = true;
  authGateEl.hidden = false;
  forgotPasswordForm.reset();
  clearFieldError(forgotPasswordErrorEl);
  forgotPasswordSuccessEl.hidden = true;
});

forgotPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFieldError(forgotPasswordErrorEl);
  forgotPasswordSuccessEl.hidden = true;
  const email = forgotPasswordEmailInput.value.trim();
  try {
    await sendPasswordResetEmail(auth, email);
    forgotPasswordSuccessEl.hidden = false;
    forgotPasswordForm.reset();
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      // Don't reveal whether an account exists for this email - same outcome either way.
      forgotPasswordSuccessEl.hidden = false;
      forgotPasswordForm.reset();
      return;
    }
    showFieldError(forgotPasswordErrorEl, error);
  }
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

async function deleteAccount() {
  clearFieldError(accountDeleteErrorEl);
  const user = auth.currentUser;
  const uid = currentUid;
  if (!user || !uid) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    localStorage.removeItem("exercise-tracker-data");
    localStorage.removeItem("exercise-tracker-presets");
    localStorage.removeItem("exercise-tracker-sports");
    await user.delete();
  } catch (error) {
    showFieldError(accountDeleteErrorEl, error);
  }
}

accountDeleteBtn.addEventListener("click", () => {
  openConfirmModal(t("auth.deleteAccountConfirm"), deleteAccount);
});

// ---- Cloud data sync ----
const SYNCED_KEYS = [
  "exercise-tracker-data",
  "exercise-tracker-presets",
  "exercise-tracker-sports",
  "exercise-tracker-lang",
  "exercise-tracker-weight-unit",
  "exercise-tracker-distance-unit",
  "exercise-tracker-theme",
  "exercise-tracker-share-proofs",
  "exercise-tracker-photo-storage-mode",
];
const KEY_TO_FIELD = {
  "exercise-tracker-data": "exerciseData",
  "exercise-tracker-presets": "presetsData",
  "exercise-tracker-sports": "sportsData",
  "exercise-tracker-lang": "lang",
  "exercise-tracker-weight-unit": "weightUnit",
  "exercise-tracker-distance-unit": "distanceUnit",
  "exercise-tracker-theme": "theme",
  "exercise-tracker-share-proofs": "shareProofs",
  "exercise-tracker-photo-storage-mode": "photoStorageMode",
};

let currentUid = null;

const nativeSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key, value) {
  nativeSetItem(key, value);
  if (currentUid && SYNCED_KEYS.includes(key)) {
    setDoc(doc(db, "users", currentUid), { [KEY_TO_FIELD[key]]: value, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }
};

function stopVerifyEmailPolling() {
  if (verifyEmailPollInterval) {
    clearInterval(verifyEmailPollInterval);
    verifyEmailPollInterval = null;
  }
}

function showApp() {
  authGateEl.hidden = true;
  signupViewEl.hidden = true;
  forgotPasswordViewEl.hidden = true;
  usernameViewEl.hidden = true;
  verifyEmailViewEl.hidden = true;
  stopVerifyEmailPolling();
  appRootEl.hidden = false;
}

function showGate() {
  appRootEl.hidden = true;
  signupViewEl.hidden = true;
  forgotPasswordViewEl.hidden = true;
  usernameViewEl.hidden = true;
  verifyEmailViewEl.hidden = true;
  stopVerifyEmailPolling();
  authGateEl.hidden = false;
  gateAuthForm.reset();
  signupForm.reset();
  clearGateError();
  clearFieldError(signupErrorEl);
}

function showUsernamePrompt() {
  authGateEl.hidden = true;
  signupViewEl.hidden = true;
  forgotPasswordViewEl.hidden = true;
  verifyEmailViewEl.hidden = true;
  stopVerifyEmailPolling();
  appRootEl.hidden = true;
  usernameViewEl.hidden = false;
}

// ---- Email verification gate: shown after signup (email/password only -
// Google accounts are already verified by Google) until the user clicks the
// link in their inbox. A scheduled Cloud Function deletes the account if
// nothing is clicked within 10 minutes (functions/index.js). ----
let pendingVerificationUsername = null;
let verifyEmailPollInterval = null;

function renderVerifyEmailHint() {
  const email = auth.currentUser?.email || "";
  verifyEmailHintEl.textContent = t("auth.verifyEmailBody", { email });
}

async function checkEmailVerified({ silent }) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await user.reload();
  } catch (error) {
    stopVerifyEmailPolling();
    showFieldError(verifyEmailErrorEl, { code: "auth/expired-signup" });
    setTimeout(() => signOut(auth), 2500);
    return;
  }
  if (!auth.currentUser.emailVerified) {
    if (!silent) {
      verifyEmailErrorEl.textContent = t("auth.verifyEmailNotYet");
      verifyEmailErrorEl.hidden = false;
    }
    return;
  }
  clearFieldError(verifyEmailErrorEl);
  updateDoc(doc(db, "users", user.uid), { pendingEmailVerification: false }).catch(() => {});
  syncSignedInUser(auth.currentUser);
}

function showVerifyEmailPrompt(username) {
  pendingVerificationUsername = username || null;
  authGateEl.hidden = true;
  signupViewEl.hidden = true;
  forgotPasswordViewEl.hidden = true;
  usernameViewEl.hidden = true;
  appRootEl.hidden = true;
  clearFieldError(verifyEmailErrorEl);
  verifyEmailSuccessEl.hidden = true;
  renderVerifyEmailHint();
  verifyEmailViewEl.hidden = false;
  stopVerifyEmailPolling();
  verifyEmailPollInterval = setInterval(() => checkEmailVerified({ silent: true }), 5000);
}

document.addEventListener("languagechange", () => {
  if (!verifyEmailViewEl.hidden) renderVerifyEmailHint();
});

verifyEmailContinueBtn.addEventListener("click", () => checkEmailVerified({ silent: false }));

verifyEmailResendBtn.addEventListener("click", async () => {
  clearFieldError(verifyEmailErrorEl);
  verifyEmailSuccessEl.hidden = true;
  try {
    await sendEmailVerification(auth.currentUser);
    verifyEmailSuccessEl.hidden = false;
  } catch (error) {
    showFieldError(verifyEmailErrorEl, error);
  }
});

verifyEmailCancelBtn.addEventListener("click", () => {
  openConfirmModal(t("auth.verifyEmailCancelConfirm"), async () => {
    const user = auth.currentUser;
    stopVerifyEmailPolling();
    if (!user) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", user.uid));
      if (pendingVerificationUsername) {
        batch.delete(doc(db, "usernames", pendingVerificationUsername.toLowerCase()));
      }
      await batch.commit();
      await user.delete();
    } catch (error) {
      console.warn("cancelPendingSignup failed", error);
      signOut(auth);
    }
  });
});

usernameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  usernameErrorEl.hidden = true;
  const value = usernameInput.value.trim();
  const birthdate = usernameBirthdateInput.value;
  if (!value || !birthdate || !currentUid) return;
  // First time finishing account setup: default proof photos to local
  // storage rather than the app's normal cloud fallback, unless this device
  // already had an explicit choice (e.g. used the app locally before signing up).
  if (localStorage.getItem("exercise-tracker-photo-storage-mode") === null) {
    localStorage.setItem("exercise-tracker-photo-storage-mode", "local");
  }
  try {
    // Claiming the lowercased usernames/{lower} doc and setting users/{uid}.username
    // happen atomically: if the name is already taken, security rules reject the
    // usernames write and the whole batch fails, so the user is never left with a
    // "set" username that was never actually claimed (there's no rename UI to fix that later).
    // Email/password accounts need to confirm their address before they can
    // use the app (see showVerifyEmailPrompt below); Google accounts are
    // already verified by Google, so they skip straight into the app.
    const requiresEmailVerification = !auth.currentUser?.emailVerified;
    const batch = writeBatch(db);
    batch.set(
      doc(db, "users", currentUid),
      {
        username: value,
        birthdate,
        pendingEmailVerification: requiresEmailVerification,
        ...(requiresEmailVerification ? { verificationSentAt: serverTimestamp() } : {}),
      },
      { merge: true }
    );
    batch.set(doc(db, "usernames", value.toLowerCase()), { uid: currentUid, username: value });
    await batch.commit();
  } catch (error) {
    usernameErrorEl.textContent = t(error?.code === "permission-denied" ? "auth.errorUsernameTaken" : "auth.errorGeneric");
    usernameErrorEl.hidden = false;
    return;
  }
  accountUsernameDisplay.textContent = value;
  accountBirthdateDisplay.textContent = formatBirthdate(birthdate);
  usernameForm.reset();
  if (!auth.currentUser.emailVerified) {
    sendEmailVerification(auth.currentUser).catch((error) => console.warn("sendEmailVerification failed", error));
    showVerifyEmailPrompt(value);
    return;
  }
  showApp();
});

// ---- Password visibility toggle (login + signup) ----
const EYE_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 10.6a3 3 0 0 0 4.24 4.24"/><path d="M9.9 4.24A10.4 10.4 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-2.16 3.19M6.1 6.1C3.4 7.9 2 10.9 2 11c0 0 3.5 7 10 7 1.06 0 2.06-.18 3-.5"/></svg>';

document.querySelectorAll(".password-toggle-btn").forEach((btn) => {
  const input = btn.previousElementSibling;
  function updateToggleBtn() {
    const showing = input.type === "text";
    btn.classList.toggle("active", showing);
    btn.innerHTML = showing ? EYE_OFF_ICON : EYE_ICON;
    btn.title = t(showing ? "auth.hidePassword" : "auth.showPassword");
  }
  btn.addEventListener("click", () => {
    input.type = input.type === "text" ? "password" : "text";
    updateToggleBtn();
  });
  document.addEventListener("languagechange", updateToggleBtn);
});

async function syncSignedInUser(user) {
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

    if (data.pendingEmailVerification && !user.emailVerified) {
      showVerifyEmailPrompt(data.username);
      return;
    }
    if (data.pendingEmailVerification && user.emailVerified) {
      updateDoc(userDocRef, { pendingEmailVerification: false }).catch(() => {});
    }

    accountUsernameDisplay.textContent = data.username;
    accountBirthdateDisplay.textContent = formatBirthdate(data.birthdate);
    ensureUsernameMapping(currentUid, data.username);
    registerPushToken(currentUid);

    let anyDiff = false;
    SYNCED_KEYS.forEach((key) => {
      const field = KEY_TO_FIELD[key];
      if (data[field] === undefined) return;
      if (localStorage.getItem(key) !== data[field]) anyDiff = true;
      nativeSetItem(key, data[field]);
    });
    if (anyDiff) {
      // Cloud data differs from what's on this device (first time signing in
      // here, or it changed elsewhere) - the scripts that render from
      // localStorage already ran with the old value, so a reload is the only
      // way to get them to pick up what was just pulled down.
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
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    currentUid = null;
    accountUsernameDisplay.textContent = "";
    accountEmailDisplay.textContent = "";
    accountBirthdateDisplay.textContent = "";
    showGate();
    return;
  }
  syncSignedInUser(user);
});
