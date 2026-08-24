// Makes the Android hardware/gesture back button step back through whatever
// screens were actually visited, in the exact order they were visited -
// no hardcoded "subpage X belongs to parent Y" rules. It works by watching
// every top-level view element's `hidden` attribute and recording each
// distinct combination as a browser history entry; the back button just
// replays that history one step at a time, same as a normal back button.
(function () {
  const TRACKED_IDS = [
    "auth-gate",
    "forgot-password-view",
    "signup-view",
    "username-view",
    "app-root",
    "timer-view",
    "sports-view",
    "profile-view",
    "account-view",
    "friends-view",
    "units-view",
    "backup-view",
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

  Capacitor.Plugins.App.addListener("backButton", () => {
    if (historyDepth > 0) {
      window.history.back();
    } else {
      Capacitor.Plugins.App.exitApp();
    }
  });
})();
