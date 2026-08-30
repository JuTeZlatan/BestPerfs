const STORAGE_KEY = "exercise-tracker-data";

function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString(getLang(), { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const listEl = document.getElementById("exercise-list");
const formEl = document.getElementById("add-form");
const inputEl = document.getElementById("exercise-input");
const exerciseSelectEl = document.getElementById("exercise-select");
const repsInputEl = document.getElementById("exercise-reps-input");
const weightInputEl = document.getElementById("exercise-weight-input");
const emptyStateEl = document.getElementById("empty-state");

const PRESET_EXERCISE_LABEL_KEYS = {
  pushups: "exercise.pushups",
  situps: "exercise.situps",
  pullups: "exercise.pullups",
  dips: "exercise.dips",
  benchpress: "exercise.benchpress",
  curls: "exercise.curls",
  squats: "exercise.squats",
};
const PRESET_EXERCISE_HAS_WEIGHT = {
  pushups: false,
  situps: false,
  pullups: false,
  dips: false,
  benchpress: true,
  curls: true,
  squats: true,
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
const sortDateAscBtn = document.getElementById("sort-date-asc-btn");
const sortDateDescBtn = document.getElementById("sort-date-desc-btn");
const fitnessSortBtn = document.getElementById("fitness-sort-btn");
const fitnessSortMenu = document.getElementById("fitness-sort-menu");
const confirmModal = document.getElementById("confirm-modal");
const modalMessageEl = document.getElementById("modal-message");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");

let exercises = loadExercises();
let sortOrder = "date-desc"; // "date-asc" | "date-desc" | "asc" | "desc"
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
  const sorted = [...exercises].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (sortOrder === "date-asc") sorted.reverse();
  return sorted;
}

function render() {
  listEl.innerHTML = "";
  emptyStateEl.classList.toggle("visible", exercises.length === 0);
  sortAscBtn.classList.toggle("active", sortOrder === "asc");
  sortDescBtn.classList.toggle("active", sortOrder === "desc");
  sortDateAscBtn.classList.toggle("active", sortOrder === "date-asc");
  sortDateDescBtn.classList.toggle("active", sortOrder === "date-desc");
  fitnessSortBtn.classList.toggle("active", sortOrder !== "date-desc");

  let lastMonthKey = null;
  getSortedExercises().forEach((exercise) => {
    const monthKey = exercise.date ? exercise.date.slice(0, 7) : null;
    if (monthKey && monthKey !== lastMonthKey) {
      const separator = document.createElement("div");
      separator.className = "sport-month-separator";
      separator.textContent = monthLabel(monthKey);
      listEl.appendChild(separator);
      lastMonthKey = monthKey;
    }

    const node = templateEl.content.cloneNode(true);
    const rowRootEl = node.querySelector(".exercise-row");
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

    const proofBtn = node.querySelector(".perf-proof-btn");
    const proofDeleteBadge = node.querySelector(".perf-proof-delete-badge");
    const proofAddBtn = node.querySelector(".perf-proof-add-btn");
    let proofControlsEditing = false;

    function updateProofControls() {
      const hasPhotos = !!(exercise.photos && exercise.photos.length);
      if (proofBtn) proofBtn.hidden = !hasPhotos;
      if (proofDeleteBadge) proofDeleteBadge.hidden = !(proofControlsEditing && hasPhotos);
      if (proofAddBtn) proofAddBtn.hidden = !(proofControlsEditing && !hasPhotos);
    }
    updateProofControls();

    // Edit mode stays on until a tap lands outside this row - not on blur,
    // since focusing the delete-badge/add-button (or a photo picker/modal
    // triggered from them) would otherwise blur the field and immediately
    // kick us back out before the click could even register.
    function handleOutsideProofClick(e) {
      if (rowRootEl.contains(e.target)) return;
      if (e.target.closest(".modal-overlay, .proof-viewer")) return;
      exitProofEditMode();
    }
    function exitProofEditMode() {
      proofControlsEditing = false;
      updateProofControls();
      // If a field was never actually tapped into, it never blurred, so its
      // own blur handler (which normally resets this) never ran either.
      nameInput.readOnly = true;
      repsInput.readOnly = true;
      weightInput.readOnly = true;
      document.removeEventListener("click", handleOutsideProofClick, true);
    }
    function enterProofEditMode() {
      proofControlsEditing = true;
      updateProofControls();
      document.addEventListener("click", handleOutsideProofClick, true);
    }

    if (proofBtn) {
      proofBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.openProofViewer && window.openProofViewer(exercise.photos);
      });
    }
    if (proofDeleteBadge) {
      proofDeleteBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        window.openProofManager &&
          window.openProofManager(exercise, () => {
            saveExercises();
            updateProofControls();
          });
      });
    }
    if (proofAddBtn) {
      proofAddBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.addPhotosNow &&
          window.addPhotosNow(exercise, () => {
            saveExercises();
            updateProofControls();
          });
      });
    }

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
      enterProofEditMode();
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
  const exercise = exercises.find((e) => e.id === id);
  window.deleteProofPhotos && window.deleteProofPhotos(exercise && exercise.photos);
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

function addExercise(exerciseKey, name, reps, weight) {
  const exercise = {
    id: crypto.randomUUID(),
    exerciseKey,
    name,
    maxReps: reps,
    maxWeight: weight,
    date: window.todayISO ? window.todayISO() : new Date().toISOString().slice(0, 10),
  };
  exercises.push(exercise);
  saveExercises();
  render();
  return exercise;
}

function hasWeightForSelectValue(value) {
  return value === "manual" ? true : PRESET_EXERCISE_HAS_WEIGHT[value];
}

function updateWeightInputVisibility(value) {
  weightInputEl.hidden = !hasWeightForSelectValue(value);
  weightInputEl.placeholder = weightUnitLabel();
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
  inputEl.value = "";
  repsInputEl.value = "";
  weightInputEl.value = "";
  updateWeightInputVisibility(first.dataset.value);
}

(function bindExerciseSelect() {
  const btn = exerciseSelectEl.querySelector(".distance-dropdown-btn");
  const label = exerciseSelectEl.querySelector(".distance-dropdown-label");
  const menu = exerciseSelectEl.querySelector(".distance-dropdown-menu");

  updateWeightInputVisibility(exerciseSelectEl.dataset.value);

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
      updateWeightInputVisibility(option.dataset.value);
      if (isManual) inputEl.focus();
    });
  });

  document.addEventListener("click", (e) => {
    if (!menu.hidden && !exerciseSelectEl.contains(e.target)) menu.hidden = true;
  });

  document.addEventListener("languagechange", () => {
    const active = menu.querySelector(".sport-option.active");
    if (active) label.textContent = active.textContent;
    weightInputEl.placeholder = weightUnitLabel();
  });
})();

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = exerciseSelectEl.dataset.value;
  const reps = repsInputEl.value === "" ? null : Number(repsInputEl.value);
  const weight = weightInputEl.hidden || weightInputEl.value === "" ? null : weightFromDisplay(Number(weightInputEl.value));
  let exercise;
  if (key === "manual") {
    const name = inputEl.value.trim();
    if (!name) return;
    exercise = addExercise(null, name, reps, weight);
  } else {
    exercise = addExercise(key, null, reps, weight);
  }
  resetExerciseSelect();
  const saveAndRender = () => {
    saveExercises();
    render();
  };
  let keepGoing = true;
  if (window.promptForPerfDate) keepGoing = await window.promptForPerfDate(exercise, saveAndRender);
  if (!keepGoing) {
    deleteExercise(exercise.id);
    return;
  }
  if (window.promptForProofPhotos) await window.promptForProofPhotos(exercise, saveAndRender);
});

sortAscBtn.addEventListener("click", () => {
  sortOrder = "asc";
  render();
  fitnessSortMenu.hidden = true;
});

sortDescBtn.addEventListener("click", () => {
  sortOrder = "desc";
  render();
  fitnessSortMenu.hidden = true;
});

sortDateAscBtn.addEventListener("click", () => {
  sortOrder = "date-asc";
  render();
  fitnessSortMenu.hidden = true;
});

sortDateDescBtn.addEventListener("click", () => {
  sortOrder = "date-desc";
  render();
  fitnessSortMenu.hidden = true;
});

fitnessSortBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const opening = fitnessSortMenu.hidden;
  window.closeAllDropdowns();
  fitnessSortMenu.hidden = !opening;
});

document.addEventListener("click", (e) => {
  if (!fitnessSortMenu.hidden && !fitnessSortMenu.contains(e.target) && e.target !== fitnessSortBtn) {
    fitnessSortMenu.hidden = true;
  }
});

document.addEventListener("languagechange", render);
document.addEventListener("unitschange", render);

render();
