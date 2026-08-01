const STORAGE_KEY = "exercise-tracker-data";

const listEl = document.getElementById("exercise-list");
const formEl = document.getElementById("add-form");
const inputEl = document.getElementById("exercise-input");
const emptyStateEl = document.getElementById("empty-state");
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
    nameInput.value = exercise.name;
    nameInput.placeholder = t("exercise.namePlaceholder");

    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") nameInput.blur();
    });

    nameInput.addEventListener("blur", () => {
      nameInput.readOnly = true;
      const newName = nameInput.value.trim();
      if (!newName) {
        nameInput.value = exercise.name;
        return;
      }
      if (newName === exercise.name) return;
      exercise.name = newName;
      saveExercises();
      render();
    });

    const editBtn = node.querySelector(".edit-btn");
    editBtn.title = t("edit.title");
    editBtn.addEventListener("click", () => {
      nameInput.readOnly = false;
      nameInput.focus();
      nameInput.select();
    });

    const fieldLabels = node.querySelectorAll(".inline-field-label");
    fieldLabels[0].textContent = t("field.reps");
    fieldLabels[1].textContent = t("field.kg");

    const repsInput = node.querySelector(".reps-input");
    const weightInput = node.querySelector(".weight-input");
    repsInput.value = exercise.maxReps ?? "";
    weightInput.value = exercise.maxWeight ?? "";

    repsInput.addEventListener("input", () => {
      exercise.maxReps = repsInput.value === "" ? null : Number(repsInput.value);
      saveExercises();
    });

    weightInput.addEventListener("input", () => {
      exercise.maxWeight = weightInput.value === "" ? null : Number(weightInput.value);
      saveExercises();
    });

    const deleteBtn = node.querySelector(".delete-btn");
    deleteBtn.title = t("delete.title");
    deleteBtn.addEventListener("click", () => {
      openConfirmModal(t("modal.deleteExercise"), () => deleteExercise(exercise.id));
    });

    listEl.appendChild(node);
  });
}

function openConfirmModal(message, onConfirm, confirmLabel) {
  modalMessageEl.textContent = message;
  modalConfirmBtn.textContent = confirmLabel || t("modal.confirm");
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

function addExercise(name) {
  exercises.push({
    id: crypto.randomUUID(),
    name,
    maxReps: null,
    maxWeight: null,
  });
  saveExercises();
  render();
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = inputEl.value.trim();
  if (!name) return;
  addExercise(name);
  inputEl.value = "";
  inputEl.focus();
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

render();
