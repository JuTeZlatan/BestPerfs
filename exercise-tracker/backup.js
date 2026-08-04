const BACKUP_KEYS = ["exercise-tracker-data", "exercise-tracker-presets", "exercise-tracker-sports", "exercise-tracker-lang"];

const backupToggle = document.getElementById("profile-backup-toggle");
const backupPanel = document.getElementById("profile-backup-panel");
const backupExportBtn = document.getElementById("backup-export-btn");
const backupImportBtn = document.getElementById("backup-import-btn");
const backupImportInput = document.getElementById("backup-import-input");

function closeBackupPanel() {
  backupPanel.hidden = true;
  backupToggle.setAttribute("aria-expanded", "false");
  backupToggle.classList.remove("open");
}

backupToggle.addEventListener("click", () => {
  const willOpen = backupPanel.hidden;
  backupPanel.hidden = !willOpen;
  backupToggle.setAttribute("aria-expanded", String(willOpen));
  backupToggle.classList.toggle("open", willOpen);
});

function exportBackupData() {
  const data = {};
  BACKUP_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) data[key] = raw;
  });
  const payload = { app: "best-perfs", version: 1, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `best-perfs-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeBackupPanel();
}

function importBackupData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed.data !== "object") throw new Error("invalid backup");
    } catch {
      alert(t("backup.importError"));
      return;
    }
    if (!confirm(t("backup.importConfirm"))) return;
    BACKUP_KEYS.forEach((key) => {
      if (parsed.data[key] !== undefined) localStorage.setItem(key, parsed.data[key]);
    });
    location.reload();
  };
  reader.readAsText(file);
}

backupExportBtn.addEventListener("click", exportBackupData);

backupImportBtn.addEventListener("click", () => {
  backupImportInput.value = "";
  backupImportInput.click();
});

backupImportInput.addEventListener("change", () => {
  const file = backupImportInput.files[0];
  closeBackupPanel();
  if (file) importBackupData(file);
});
