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

// ---- Statistics: placeholder for now, will surface real numbers computed
// from the user's own logged performances once that's built. ----
const profileStatisticsRow = document.getElementById("profile-statistics-row");
const statisticsViewEl = document.getElementById("statistics-view");
const statisticsBackBtn = document.getElementById("statistics-back-btn");

profileStatisticsRow.addEventListener("click", () => {
  profileViewForSupport.hidden = true;
  statisticsViewEl.hidden = false;
});

statisticsBackBtn.addEventListener("click", () => {
  statisticsViewEl.hidden = true;
  profileViewForSupport.hidden = false;
});

// ---- Statistics filter dropdown: Général plus every tracked sport. Only
// wires the picker itself for now - the actual numbers per filter are a
// later pass, so every choice still shows the same "coming soon" message. ----
const statisticsSelectBtn = document.getElementById("statistics-select-btn");
const statisticsSelectLabel = document.getElementById("statistics-select-label");
const statisticsSelectIcon = document.getElementById("statistics-select-icon");
const statisticsMenuEl = document.getElementById("statistics-menu");
let currentStatFilter = "general";

function selectStatFilter(option) {
  currentStatFilter = option.dataset.stat;
  statisticsMenuEl.querySelectorAll(".sport-option").forEach((btn) => btn.classList.toggle("active", btn === option));
  statisticsSelectLabel.textContent = option.querySelector("span:last-child").textContent;
  statisticsSelectIcon.innerHTML = option.querySelector(".view-icon").innerHTML;
}

statisticsSelectBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const opening = statisticsMenuEl.hidden;
  window.closeAllDropdowns();
  statisticsMenuEl.hidden = !opening;
});

statisticsMenuEl.querySelectorAll(".sport-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectStatFilter(btn);
    statisticsMenuEl.hidden = true;
  });
});

document.addEventListener("click", (e) => {
  if (!statisticsMenuEl.hidden && !statisticsMenuEl.contains(e.target) && e.target !== statisticsSelectBtn) {
    statisticsMenuEl.hidden = true;
  }
});

document.addEventListener("languagechange", () => {
  const active = statisticsMenuEl.querySelector(".sport-option.active");
  if (active) statisticsSelectLabel.textContent = active.querySelector("span:last-child").textContent;
});

selectStatFilter(statisticsMenuEl.querySelector('.sport-option[data-stat="general"]'));

document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    supportViewEl.hidden = true;
    statisticsViewEl.hidden = true;
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
