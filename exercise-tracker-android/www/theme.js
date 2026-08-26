const THEME_STORAGE_KEY = "exercise-tracker-theme";
const THEMES = ["classic", "carbon", "ocean", "emerald", "violet", "gold", "pink", "charcoal", "sunset", "arctic", "indigo"];

function getTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.includes(saved) ? saved : "classic";
}

function applyTheme(theme) {
  if (theme === "classic") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

function updateThemeRows() {
  document.querySelectorAll(".theme-row").forEach((btn) => {
    const active = btn.dataset.themeId === getTheme();
    btn.classList.toggle("active", active);
    const check = btn.querySelector(".theme-row-check");
    if (check) check.textContent = active ? "✓" : "";
  });
}

function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  updateThemeRows();
}
window.setTheme = setTheme;

// ---- Preferences UI (Profil > Thèmes) ----
const profileThemesRow = document.getElementById("profile-themes-row");
const profileViewForThemes = document.getElementById("profile-view");
const themesViewEl = document.getElementById("themes-view");
const themesBackBtn = document.getElementById("themes-back-btn");

profileThemesRow.addEventListener("click", () => {
  profileViewForThemes.hidden = true;
  themesViewEl.hidden = false;
});

themesBackBtn.addEventListener("click", () => {
  themesViewEl.hidden = true;
  profileViewForThemes.hidden = false;
});

document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    themesViewEl.hidden = true;
  });
});

document.querySelectorAll(".theme-row").forEach((btn) => {
  btn.addEventListener("click", () => {
    setTheme(btn.dataset.themeId);
  });
});

applyTheme(getTheme());
updateThemeRows();
