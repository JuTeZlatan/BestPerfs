// Makes the Android hardware/gesture back button step back through the
// app's own screens (subpage -> its parent, non-default tab -> Sports)
// instead of closing the app, matching what a back button normally does.
// Only exits the app once there's truly nothing left to undo.
(function () {
  const isNativePlatform = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  if (!isNativePlatform) return;

  const SUBPAGES = [
    ["account-view", "account-back-btn"],
    ["friends-view", "friends-back-btn"],
    ["units-view", "units-back-btn"],
    ["backup-view", "backup-back-btn"],
    ["support-view", "support-back-btn"],
    ["signup-view", "signup-back-btn"],
    ["forgot-password-view", "forgot-password-back-btn"],
  ];

  function stepBack() {
    for (const [viewId, backBtnId] of SUBPAGES) {
      const view = document.getElementById(viewId);
      if (view && !view.hidden) {
        document.getElementById(backBtnId).click();
        return true;
      }
    }

    const appRoot = document.getElementById("app-root");
    if (appRoot && !appRoot.hidden) {
      const profileView = document.getElementById("profile-view");
      const timerView = document.getElementById("timer-view");
      if ((profileView && !profileView.hidden) || (timerView && !timerView.hidden)) {
        document.querySelector('.bottom-nav-btn[data-view="sports"]').click();
        return true;
      }
    }

    return false;
  }

  Capacitor.Plugins.App.addListener("backButton", () => {
    if (!stepBack()) {
      Capacitor.Plugins.App.exitApp();
    }
  });
})();
