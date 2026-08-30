// Web/browser back: replays whatever screens were actually visited, in the
// exact order they were visited. It works by watching every top-level view
// element's `hidden` attribute and recording each distinct combination as a
// browser history entry; the back button just replays that history one step
// at a time, same as a normal back button.
//
// Android hardware/gesture back button: uses a fixed parent hierarchy
// instead (see PARENT below) so it always steps up the same menu tree no
// matter how the current screen was reached.
(function () {
  const TRACKED_IDS = [
    "auth-gate",
    "forgot-password-view",
    "signup-view",
    "username-view",
    "app-root",
    "timer-view",
    "sports-view",
    "classement-view",
    "profile-view",
    "account-view",
    "friends-view",
    "units-view",
    "themes-view",
    "language-view",
    "privacy-view",
    "storage-view",
    "support-view",
  ];

  function snapshot() {
    const state = {};
    TRACKED_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) state[id] = el.hidden;
    });
    return state;
  }

  function snapshotsEqual(a, b) {
    return TRACKED_IDS.every((id) => a[id] === b[id]);
  }

  let lastSnapshot = null;
  let baselineSet = false;
  let historyDepth = 0;

  function applySnapshot(state) {
    // Set this first so the MutationObserver sees no diff once it fires
    // for the `hidden` changes this function is about to make.
    lastSnapshot = state;
    TRACKED_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && id in state) el.hidden = state[id];
    });
  }

  const observer = new MutationObserver(() => {
    const current = snapshot();

    if (!baselineSet) {
      // The very first settled screen (post-splash) is the pristine state:
      // record it, but don't make it a navigable history entry.
      lastSnapshot = current;
      history.replaceState(current, "");
      baselineSet = true;
      return;
    }

    if (snapshotsEqual(current, lastSnapshot)) return;
    lastSnapshot = current;
    historyDepth++;
    history.pushState(current, "");
  });

  observer.observe(document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true });

  window.addEventListener("popstate", (event) => {
    if (!event.state) return;
    historyDepth = Math.max(0, historyDepth - 1);
    applySnapshot(event.state);
  });

  const isNativePlatform = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  if (!isNativePlatform) return;

  // The hardware/gesture back button doesn't replay raw navigation history
  // (that could bounce sideways between sibling subpages depending on how
  // the user got there) - it always steps up a fixed parent chain, like a
  // menu tree: Langue -> Profil -> Sports (home) -> exit app, regardless of
  // the exact path taken to reach the current screen.
  const PARENT = {
    "account-view": "profile-view",
    "friends-view": "profile-view",
    "units-view": "profile-view",
    "themes-view": "profile-view",
    "language-view": "profile-view",
    "privacy-view": "profile-view",
    "storage-view": "profile-view",
    "support-view": "profile-view",
    "profile-view": "sports-view",
    "timer-view": "sports-view",
    "classement-view": "sports-view",
    "forgot-password-view": "auth-gate",
    "signup-view": "auth-gate",
    "username-view": "auth-gate",
  };

  function currentLeaf() {
    return Object.keys(PARENT).find((id) => {
      const el = document.getElementById(id);
      return el && !el.hidden;
    });
  }

  // Fullscreen overlays and modals aren't part of the view tree above, so
  // the back button has to check for them first and dismiss whichever is
  // open (by clicking its own close/cancel button, so it resolves exactly
  // like a real tap would) instead of falling through to view navigation
  // or minimizing the app.
  const DISMISSIBLE_OVERLAYS = [
    ["proof-viewer", "proof-viewer-close-btn"],
    ["proof-source-modal", "proof-source-cancel-btn"],
    ["proof-prompt-modal", "proof-prompt-cancel-btn"],
    ["date-prompt-modal", "date-prompt-cancel-btn"],
    ["proof-manager-modal", "proof-manager-close-btn"],
    ["friends-add-modal", "friends-add-cancel-btn"],
    ["confirm-modal", "modal-cancel-btn"],
  ];

  function closeTopOverlay() {
    for (const [overlayId, closeBtnId] of DISMISSIBLE_OVERLAYS) {
      const overlay = document.getElementById(overlayId);
      if (overlay && !overlay.hidden) {
        const btn = document.getElementById(closeBtnId);
        if (btn) btn.click();
        return true;
      }
    }
    return false;
  }

  function goBackOneLevel() {
    const leaf = currentLeaf();
    if (!leaf) return false; // already on Sports (home) or the login gate
    document.getElementById(leaf).hidden = true;
    const parent = PARENT[leaf];
    if (parent === "sports-view") {
      window.showView("sports");
    } else {
      document.getElementById(parent).hidden = false;
    }
    return true;
  }

  Capacitor.Plugins.App.addListener("backButton", () => {
    if (closeTopOverlay()) return;
    if (!goBackOneLevel()) {
      // Minimize rather than exitApp(): exitApp() destroys the Activity/WebView,
      // so coming back later replays the splash screens and loses whatever
      // screen the user was on. minimizeApp() just backgrounds the app (like
      // pressing Home), keeping everything in memory so returning to it is
      // instant and resumes exactly where it left off.
      Capacitor.Plugins.App.minimizeApp();
    }
  });
})();
