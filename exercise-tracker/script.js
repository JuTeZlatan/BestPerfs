const STORAGE_KEY = "exercise-tracker-data";

const listEl = document.getElementById("exercise-list");
const formEl = document.getElementById("add-form");
const inputEl = document.getElementById("exercise-input");
const exerciseSelectEl = document.getElementById("exercise-select");
const emptyStateEl = document.getElementById("empty-state");

const PRESET_EXERCISE_LABEL_KEYS = {
  pushups: "exercise.pushups",
  situps: "exercise.situps",
  pullups: "exercise.pullups",
  dips: "exercise.dips",
  benchpress: "exercise.benchpress",
};
const PRESET_EXERCISE_HAS_WEIGHT = {
  pushups: false,
  situps: false,
  pullups: false,
  dips: false,
  benchpress: true,
};

function exerciseDisplayName(exercise) {
  return exercise.exerciseKey ? t(PRESET_EXERCISE_LABEL_KEYS[exercise.exerciseKey]) : exercise.name;
}

function exerciseHasWeight(exercise) {
  return exercise.exerciseKey ? PRESET_EXERCISE_HAS_WEIGHT[exercise.exerciseKey] : true;
}
const templateEl = document.getElementById("exercise-template");
const sortAscBtn = document.getElementById("sort-asc-btn");
const sortDescBtn = document.getElementById("sort-desc-btn");
const confirmModal = document.getElementById("confirm-modal");
const modalMessageEl = document.getElementById("modal-message");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");

let exercises = loadExercises();
let sortOrder = null; // null | "asc" | "desc"
let pendingConfirmAction = null;

// ---- Row "..." menu (edit / delete), shared by script.js and sports.js ----
function closeAllRowMenus() {
  document.querySelectorAll(".row-menu-dropdown").forEach((dropdown) => {
    dropdown.hidden = true;
  });
}

function toggleRowMenu(dropdown) {
  const wasHidden = dropdown.hidden;
  window.closeAllDropdowns();
  dropdown.hidden = !wasHidden;
}

document.addEventListener("click", () => {
  closeAllRowMenus();
});

function loadExercises() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExercises() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));
  window.syncFitnessLeaderboardEntries && window.syncFitnessLeaderboardEntries(exercises);
}

function getSortedExercises() {
  if (sortOrder === "asc") {
    return [...exercises].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }
  if (sortOrder === "desc") {
    return [...exercises].sort((a, b) => b.name.localeCompare(a.name, "fr"));
  }
  return exercises;
}

function render() {
  listEl.innerHTML = "";
  emptyStateEl.classList.toggle("visible", exercises.length === 0);
  sortAscBtn.classList.toggle("active", sortOrder === "asc");
  sortDescBtn.classList.toggle("active", sortOrder === "desc");

  getSortedExercises().forEach((exercise) => {
    const node = templateEl.content.cloneNode(true);
    const nameInput = node.querySelector(".exercise-name");
    const displayName = exerciseDisplayName(exercise);
    nameInput.value = displayName;
    nameInput.placeholder = t("exercise.namePlaceholder");

    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") nameInput.blur();
    });

    nameInput.addEventListener("blur", () => {
      nameInput.readOnly = true;
      const newName = nameInput.value.trim();
      if (!newName) {
        nameInput.value = displayName;
        return;
      }
      if (newName === displayName) return;
      exercise.exerciseKey = null;
      exercise.name = newName;
      saveExercises();
      render();
    });

    const weightField = node.querySelector(".weight-field");
    weightField.hidden = !exerciseHasWeight(exercise);

    const fieldLabels = node.querySelectorAll(".inline-field-label");
    fieldLabels[0].textContent = t("field.reps");
    fieldLabels[1].textContent = weightUnitLabel();

    const repsInput = node.querySelector(".reps-input");
    const weightInput = node.querySelector(".weight-input");
    repsInput.value = exercise.maxReps ?? "";
    weightInput.value = exercise.maxWeight == null ? "" : weightToDisplay(exercise.maxWeight);

    repsInput.addEventListener("input", () => {
      exercise.maxReps = repsInput.value === "" ? null : Number(repsInput.value);
      saveExercises();
    });
    repsInput.addEventListener("blur", () => {
      repsInput.readOnly = true;
    });

    weightInput.addEventListener("input", () => {
      exercise.maxWeight = weightInput.value === "" ? null : weightFromDisplay(Number(weightInput.value));
      saveExercises();
    });
    weightInput.addEventListener("blur", () => {
      weightInput.readOnly = true;
    });

    const rowMenuBtn = node.querySelector(".row-menu-btn");
    const rowMenuDropdown = node.querySelector(".row-menu-dropdown");
    rowMenuBtn.title = t("rowMenu.title");
    rowMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleRowMenu(rowMenuDropdown);
    });

    const rowMenuEditBtn = node.querySelector(".row-menu-edit");
    rowMenuEditBtn.textContent = t("edit.title");
    rowMenuEditBtn.addEventListener("click", () => {
      closeAllRowMenus();
      nameInput.readOnly = false;
      repsInput.readOnly = false;
      weightInput.readOnly = false;
      nameInput.focus();
      nameInput.select();
    });

    const rowMenuDeleteBtn = node.querySelector(".row-menu-delete");
    rowMenuDeleteBtn.textContent = t("delete.title");
    rowMenuDeleteBtn.addEventListener("click", () => {
      closeAllRowMenus();
      openConfirmModal(t("modal.deleteExercise"), () => deleteExercise(exercise.id));
    });

    listEl.appendChild(node);
  });
}

function openConfirmModal(message, onConfirm) {
  modalMessageEl.textContent = message;
  pendingConfirmAction = onConfirm;
  confirmModal.hidden = false;
}
window.openConfirmModal = openConfirmModal;

function closeConfirmModal() {
  pendingConfirmAction = null;
  confirmModal.hidden = true;
}

function deleteExercise(id) {
  exercises = exercises.filter((e) => e.id !== id);
  saveExercises();
  render();
}

modalCancelBtn.addEventListener("click", closeConfirmModal);

modalConfirmBtn.addEventListener("click", () => {
  if (pendingConfirmAction) pendingConfirmAction();
  closeConfirmModal();
});

confirmModal.addEventListener("click", (e) => {
  if (e.target === confirmModal) closeConfirmModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !confirmModal.hidden) closeConfirmModal();
});

function addExercise(exerciseKey, name) {
  exercises.push({
    id: crypto.randomUUID(),
    exerciseKey,
    name,
    maxReps: null,
    maxWeight: null,
  });
  saveExercises();
  render();
}

function resetExerciseSelect() {
  const menu = exerciseSelectEl.querySelector(".distance-dropdown-menu");
  const label = exerciseSelectEl.querySelector(".distance-dropdown-label");
  const options = menu.querySelectorAll(".sport-option");
  const first = options[0];
  options.forEach((o) => o.classList.toggle("active", o === first));
  exerciseSelectEl.dataset.value = first.dataset.value;
  label.textContent = first.textContent;
  inputEl.hidden = true;
  inputEl.required = false;
}

(function bindExerciseSelect() {
  const btn = exerciseSelectEl.querySelector(".distance-dropdown-btn");
  const label = exerciseSelectEl.querySelector(".distance-dropdown-label");
  const menu = exerciseSelectEl.querySelector(".distance-dropdown-menu");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = menu.hidden;
    window.closeAllDropdowns();
    menu.hidden = !opening;
  });

  menu.querySelectorAll(".sport-option").forEach((option) => {
    option.addEventListener("click", () => {
      menu.querySelectorAll(".sport-option").forEach((o) => o.classList.remove("active"));
      option.classList.add("active");
      exerciseSelectEl.dataset.value = option.dataset.value;
      label.textContent = option.textContent;
      menu.hidden = true;
      const isManual = option.dataset.value === "manual";
      inputEl.hidden = !isManual;
      inputEl.required = isManual;
      if (isManual) inputEl.focus();
    });
  });

  document.addEventListener("click", (e) => {
    if (!menu.hidden && !exerciseSelectEl.contains(e.target)) menu.hidden = true;
  });

  document.addEventListener("languagechange", () => {
    const active = menu.querySelector(".sport-option.active");
    if (active) label.textContent = active.textContent;
  });
})();

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const key = exerciseSelectEl.dataset.value;
  if (key === "manual") {
    const name = inputEl.value.trim();
    if (!name) return;
    addExercise(null, name);
  } else {
    addExercise(key, null);
  }
  inputEl.value = "";
  resetExerciseSelect();
});

sortAscBtn.addEventListener("click", () => {
  sortOrder = sortOrder === "asc" ? null : "asc";
  render();
});

sortDescBtn.addEventListener("click", () => {
  sortOrder = sortOrder === "desc" ? null : "desc";
  render();
});

document.addEventListener("languagechange", render);
document.addEventListener("unitschange", render);

render();
