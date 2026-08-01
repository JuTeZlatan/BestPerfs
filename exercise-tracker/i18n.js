const LANG_STORAGE_KEY = "exercise-tracker-lang";

const FLAG_SVGS = {
  fr: '<svg class="flag-icon" viewBox="0 0 3 2"><rect width="1" height="2" fill="#0055A4"/><rect x="1" width="1" height="2" fill="#FFFFFF"/><rect x="2" width="1" height="2" fill="#EF4135"/></svg>',
  en: '<svg class="flag-icon" viewBox="0 0 60 30"><rect width="60" height="30" fill="#00247d"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#cf142b" stroke-width="2"/><path d="M30,0 V30 M0,15 H60" stroke="#fff" stroke-width="10"/><path d="M30,0 V30 M0,15 H60" stroke="#cf142b" stroke-width="6"/></svg>',
  es: '<svg class="flag-icon" viewBox="0 0 3 2"><rect width="3" height="2" fill="#AA151B"/><rect y="0.5" width="3" height="1" fill="#F1BF00"/></svg>',
};

const TRANSLATIONS = {
  fr: {
    "doc.title": "Suivi d'exercices",
    "app.title.exercises": "💪 Suivi d'exercices",
    "app.subtitle.exercises": "Ajoute tes appareils/exercices et note tes records.",
    "app.title.chrono": "⏱️ Chrono",
    "app.subtitle.chrono": "Démarre le chrono et marque des intervalles au fil de l'effort.",
    "nav.toChrono": "⏱️ Chrono",
    "nav.toExercises": "💪 Exercices",
    "nav.toggleTitle": "Changer de vue",
    "lang.title": "Langue",
    "exercise.inputPlaceholder": "Nom de l'appareil ou exercice (ex: Développé couché)",
    "exercise.namePlaceholder": "Nom de l'exercice",
    "common.add": "Ajouter",
    "sort.label": "Trier :",
    "sort.asc": "A → Z",
    "sort.desc": "Z → A",
    "sort.ascTitle": "Ordre alphabétique croissant",
    "sort.descTitle": "Ordre alphabétique décroissant",
    "exercise.empty": "Aucun exercice pour l'instant. Ajoute-en un ci-dessous !",
    "field.reps": "Reps",
    "field.kg": "kg",
    "field.min": "Min",
    "field.sec": "Sec",
    "edit.title": "Modifier le nom",
    "delete.title": "Supprimer",
    "modal.deleteExercise": "Supprimer cet exercice ?",
    "modal.deletePreset": 'Supprimer le chrono "{name}" ?',
    "modal.cancel": "Annuler",
    "modal.confirm": "Supprimer",
    "timer.start": "Démarrer",
    "timer.pause": "Pause",
    "timer.resume": "Reprendre",
    "timer.reset": "Réinitialiser",
    "timer.lap": "Intervalle",
    "timer.lapLabel": "Intervalle",
    "presets.sectionTitle": "Chronos prédéfinis",
    "presets.namePlaceholder": "Nom (ex: Repos)",
    "presets.rowNamePlaceholder": "Nom du chrono",
    "presets.minPlaceholder": "Min",
    "presets.secPlaceholder": "Sec",
    "presets.empty": "Aucun chrono enregistré. Ajoute-en un ci-dessous !",
    "presets.playTitle": "Démarrer ce chrono",
  },
  en: {
    "doc.title": "Workout Tracker",
    "app.title.exercises": "💪 Workout Tracker",
    "app.subtitle.exercises": "Add your machines/exercises and log your records.",
    "app.title.chrono": "⏱️ Timer",
    "app.subtitle.chrono": "Start the timer and mark laps as you go.",
    "nav.toChrono": "⏱️ Timer",
    "nav.toExercises": "💪 Exercises",
    "nav.toggleTitle": "Switch view",
    "lang.title": "Language",
    "exercise.inputPlaceholder": "Machine or exercise name (e.g. Bench press)",
    "exercise.namePlaceholder": "Exercise name",
    "common.add": "Add",
    "sort.label": "Sort:",
    "sort.asc": "A → Z",
    "sort.desc": "Z → A",
    "sort.ascTitle": "Alphabetical ascending order",
    "sort.descTitle": "Alphabetical descending order",
    "exercise.empty": "No exercises yet. Add one below!",
    "field.reps": "Reps",
    "field.kg": "kg",
    "field.min": "Min",
    "field.sec": "Sec",
    "edit.title": "Edit name",
    "delete.title": "Delete",
    "modal.deleteExercise": "Delete this exercise?",
    "modal.deletePreset": 'Delete the timer "{name}"?',
    "modal.cancel": "Cancel",
    "modal.confirm": "Delete",
    "timer.start": "Start",
    "timer.pause": "Pause",
    "timer.resume": "Resume",
    "timer.reset": "Reset",
    "timer.lap": "Lap",
    "timer.lapLabel": "Lap",
    "presets.sectionTitle": "Preset timers",
    "presets.namePlaceholder": "Name (e.g. Rest)",
    "presets.rowNamePlaceholder": "Timer name",
    "presets.minPlaceholder": "Min",
    "presets.secPlaceholder": "Sec",
    "presets.empty": "No preset timers yet. Add one below!",
    "presets.playTitle": "Start this timer",
  },
  es: {
    "doc.title": "Seguimiento de ejercicios",
    "app.title.exercises": "💪 Seguimiento de ejercicios",
    "app.subtitle.exercises": "Añade tus máquinas/ejercicios y registra tus récords.",
    "app.title.chrono": "⏱️ Cronómetro",
    "app.subtitle.chrono": "Inicia el cronómetro y marca vueltas durante el esfuerzo.",
    "nav.toChrono": "⏱️ Cronómetro",
    "nav.toExercises": "💪 Ejercicios",
    "nav.toggleTitle": "Cambiar de vista",
    "lang.title": "Idioma",
    "exercise.inputPlaceholder": "Nombre del aparato o ejercicio (ej: Press de banca)",
    "exercise.namePlaceholder": "Nombre del ejercicio",
    "common.add": "Añadir",
    "sort.label": "Ordenar:",
    "sort.asc": "A → Z",
    "sort.desc": "Z → A",
    "sort.ascTitle": "Orden alfabético ascendente",
    "sort.descTitle": "Orden alfabético descendente",
    "exercise.empty": "Aún no hay ejercicios. ¡Añade uno abajo!",
    "field.reps": "Reps",
    "field.kg": "kg",
    "field.min": "Min",
    "field.sec": "Seg",
    "edit.title": "Editar nombre",
    "delete.title": "Eliminar",
    "modal.deleteExercise": "¿Eliminar este ejercicio?",
    "modal.deletePreset": '¿Eliminar el cronómetro "{name}"?',
    "modal.cancel": "Cancelar",
    "modal.confirm": "Eliminar",
    "timer.start": "Iniciar",
    "timer.pause": "Pausa",
    "timer.resume": "Reanudar",
    "timer.reset": "Reiniciar",
    "timer.lap": "Vuelta",
    "timer.lapLabel": "Vuelta",
    "presets.sectionTitle": "Cronómetros predefinidos",
    "presets.namePlaceholder": "Nombre (ej: Descanso)",
    "presets.rowNamePlaceholder": "Nombre del cronómetro",
    "presets.minPlaceholder": "Min",
    "presets.secPlaceholder": "Seg",
    "presets.empty": "Aún no hay cronómetros. ¡Añade uno abajo!",
    "presets.playTitle": "Iniciar este cronómetro",
  },
};

function getLang() {
  return localStorage.getItem(LANG_STORAGE_KEY) || "fr";
}

function t(key, vars) {
  const lang = getLang();
  let str = (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS.fr[key] || key;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      str = str.replace(`{${k}}`, vars[k]);
    });
  }
  return str;
}
window.t = t;
window.getLang = getLang;

function applyStaticTranslations() {
  document.documentElement.lang = getLang();
  document.title = t("doc.title");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });

  updateLangButton();
}

function updateLangButton() {
  const langBtn = document.getElementById("lang-btn");
  if (langBtn) langBtn.innerHTML = FLAG_SVGS[getLang()];
  document.querySelectorAll(".lang-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === getLang());
  });
}

function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  applyStaticTranslations();
  document.dispatchEvent(new CustomEvent("languagechange"));
}
window.setLang = setLang;

// ---- Language switcher UI ----
const langBtn = document.getElementById("lang-btn");
const langMenu = document.getElementById("lang-menu");

langBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  langMenu.hidden = !langMenu.hidden;
});

langMenu.querySelectorAll(".lang-option").forEach((btn) => {
  btn.addEventListener("click", () => {
    setLang(btn.dataset.lang);
    langMenu.hidden = true;
  });
});

document.addEventListener("click", (e) => {
  if (!langMenu.hidden && !langMenu.contains(e.target) && e.target !== langBtn) {
    langMenu.hidden = true;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !langMenu.hidden) langMenu.hidden = true;
});

applyStaticTranslations();
