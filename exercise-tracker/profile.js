const profileViewForSupport = document.getElementById("profile-view");
const profileSupportRow = document.getElementById("profile-support-row");
const supportViewEl = document.getElementById("support-view");
const supportBackBtn = document.getElementById("support-back-btn");

profileSupportRow.addEventListener("click", () => {
  profileViewForSupport.hidden = true;
  supportViewEl.hidden = false;
});

supportBackBtn.addEventListener("click", () => {
  supportViewEl.hidden = true;
  profileViewForSupport.hidden = false;
});

document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    supportViewEl.hidden = true;
  });
});

// ---- App version, shown at the bottom of Support - read from the native
// app itself (App.getInfo()) so it's always accurate without having to keep
// a hardcoded string in sync with android/app/build.gradle by hand ----
function renderAppVersion(targetEl) {
  if (!targetEl) return;
  const isNativePlatformForVersion = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  if (!isNativePlatformForVersion) return;
  // Always show *something* immediately, and keep it visible even if
  // getInfo() fails, instead of silently staying hidden - a stuck "loading"
  // or an explicit error is far more useful for debugging "which build is
  // actually installed" than an empty screen that looks like nothing ran.
  targetEl.hidden = false;
  targetEl.textContent = "Best Perfs (chargement de la version...)";
  if (!Capacitor.Plugins || !Capacitor.Plugins.App || !Capacitor.Plugins.App.getInfo) {
    targetEl.textContent = "Best Perfs (App.getInfo indisponible)";
    return;
  }
  Capacitor.Plugins.App.getInfo()
    .then((info) => {
      targetEl.textContent = `Best Perfs v${info.version} (${info.build})`;
    })
    .catch((error) => {
      targetEl.textContent = `Best Perfs (version indisponible : ${error?.message || error})`;
    });
}
renderAppVersion(document.getElementById("app-version-label"));
renderAppVersion(document.getElementById("landing-version-tag"));
