const THEME_STORAGE_KEY = "exercise-tracker-theme";
const THEMES = ["classic", "ocean", "emerald", "violet", "gold", "pink", "charcoal", "sunset", "arctic", "indigo"];

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

function updateThemeButton() {
  const swatch = themeBtn.querySelector(".theme-swatch");
  if (swatch) swatch.setAttribute("data-theme-swatch", getTheme());
  document.querySelectorAll(".theme-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === getTheme());
  });
}

function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  updateThemeButton();
}
window.setTheme = setTheme;

const themeBtn = document.getElementById("theme-btn");
const themeMenu = document.getElementById("theme-menu");

themeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  themeMenu.hidden = !themeMenu.hidden;
});

themeMenu.querySelectorAll(".theme-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    setTheme(btn.dataset.theme);
    themeMenu.hidden = true;
  });
});

document.addEventListener("click", (e) => {
  if (!themeMenu.hidden && !themeMenu.contains(e.target) && e.target !== themeBtn) {
    themeMenu.hidden = true;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !themeMenu.hidden) themeMenu.hidden = true;
});

applyTheme(getTheme());
updateThemeButton();
