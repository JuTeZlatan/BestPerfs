const BACKUP_KEYS = [
  "exercise-tracker-data",
  "exercise-tracker-presets",
  "exercise-tracker-sports",
  "exercise-tracker-lang",
  "exercise-tracker-weight-unit",
  "exercise-tracker-distance-unit",
  "exercise-tracker-theme",
];

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

async function exportBackupData() {
  const data = {};
  BACKUP_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) data[key] = raw;
  });
  const payload = { app: "best-perfs", version: 1, exportedAt: new Date().toISOString(), data };
  const json = JSON.stringify(payload, null, 2);
  const filename = `best-perfs-backup-${new Date().toISOString().slice(0, 10)}.json`;

  const isNativePlatform = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  if (isNativePlatform) {
    // A blob <a download> click does nothing in the Android WebView (no
    // download manager is wired up to intercept it) - write the file to the
    // app's cache dir instead and hand it to the native share sheet, so the
    // user can save it to Files/Drive or send it wherever they want.
    try {
      const written = await Capacitor.Plugins.Filesystem.writeFile({
        path: filename,
        data: json,
        directory: "CACHE",
        encoding: "utf8",
      });
      await Capacitor.Plugins.Share.share({ title: filename, url: written.uri });
    } catch (error) {
      console.error("export failed", error);
      alert(t("backup.exportError"));
    }
    return;
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
