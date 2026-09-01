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
const appVersionLabelEl = document.getElementById("app-version-label");
const isNativePlatformForVersion = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
if (isNativePlatformForVersion && Capacitor.Plugins.App) {
  Capacitor.Plugins.App.getInfo()
    .then((info) => {
      appVersionLabelEl.textContent = `Best Perfs v${info.version} (${info.build})`;
      appVersionLabelEl.hidden = false;
    })
    .catch(() => {});
}
