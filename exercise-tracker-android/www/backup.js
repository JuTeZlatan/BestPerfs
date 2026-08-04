const BACKUP_KEYS = ["exercise-tracker-data", "exercise-tracker-presets", "exercise-tracker-sports", "exercise-tracker-lang"];

const profileBackupRow = document.getElementById("profile-backup-row");
const profileViewEl = document.getElementById("profile-view");
const backupViewEl = document.getElementById("backup-view");
const backupBackBtn = document.getElementById("backup-back-btn");
const backupExportBtn = document.getElementById("backup-export-btn");
const backupImportBtn = document.getElementById("backup-import-btn");
const backupImportInput = document.getElementById("backup-import-input");

function closeBackupPanel() {
  backupViewEl.hidden = true;
  profileViewEl.hidden = false;
}

profileBackupRow.addEventListener("click", () => {
  profileViewEl.hidden = true;
  backupViewEl.hidden = false;
});

backupBackBtn.addEventListener("click", closeBackupPanel);

document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    backupViewEl.hidden = true;
  });
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
