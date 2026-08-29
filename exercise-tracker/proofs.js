import { auth, storage, storageRef, uploadBytes, getDownloadURL, deleteObject } from "./firebase-init.js";

// ---- Settings (mirrored to Firestore users/{uid} via account.js's SYNCED_KEYS) ----
const SHARE_PROOFS_KEY = "exercise-tracker-share-proofs";
const PHOTO_STORAGE_MODE_KEY = "exercise-tracker-photo-storage-mode";

function getShareProofs() {
  return localStorage.getItem(SHARE_PROOFS_KEY) !== "false";
}
function setShareProofs(value) {
  localStorage.setItem(SHARE_PROOFS_KEY, value ? "true" : "false");
}
function getPhotoStorageMode() {
  return localStorage.getItem(PHOTO_STORAGE_MODE_KEY) === "local" ? "local" : "cloud";
}
function setPhotoStorageMode(mode) {
  localStorage.setItem(PHOTO_STORAGE_MODE_KEY, mode === "local" ? "local" : "cloud");
}
window.getShareProofs = getShareProofs;
window.getPhotoStorageMode = getPhotoStorageMode;

// ---- Local storage of the actual image bytes (IndexedDB - localStorage is
// far too small for photos) ----
const PROOFS_DB_NAME = "proofs-db";
const PROOFS_STORE = "photos";

function openProofsDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PROOFS_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(PROOFS_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putPhotoBlob(id, blob) {
  const db = await openProofsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROOFS_STORE, "readwrite");
    tx.objectStore(PROOFS_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPhotoBlob(id) {
  const db = await openProofsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROOFS_STORE, "readonly");
    const req = tx.objectStore(PROOFS_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deletePhotoBlob(id) {
  const db = await openProofsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROOFS_STORE, "readwrite");
    tx.objectStore(PROOFS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Client-side resize/compression before storing or uploading ----
function compressImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const maxDim = 1280;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (out) => {
          URL.revokeObjectURL(url);
          if (out) resolve(out);
          else reject(new Error("compression failed"));
        },
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

// ---- Photo picking (web file input, or the native gallery on Android) ----
function isNativePlatform() {
  return typeof Capacitor !== "undefined" && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
}

const proofFileInput = document.getElementById("proof-file-input");
let pendingFilePickResolve = null;

proofFileInput.addEventListener("change", () => {
  const files = Array.from(proofFileInput.files || []).slice(0, 2);
  if (pendingFilePickResolve) {
    pendingFilePickResolve(files);
    pendingFilePickResolve = null;
  }
});

function pickPhotosWeb() {
  return new Promise((resolve) => {
    pendingFilePickResolve = resolve;
    proofFileInput.value = "";
    proofFileInput.click();
  });
}

async function pickPhotosNative(max) {
  const { photos } = await Capacitor.Plugins.Camera.pickImages({ limit: max, quality: 80 });
  const blobs = [];
  for (const photo of photos) {
    const response = await fetch(photo.webPath);
    blobs.push(await response.blob());
  }
  return blobs;
}

async function pickPhotos(max) {
  try {
    return isNativePlatform() ? await pickPhotosNative(max) : await pickPhotosWeb();
  } catch (error) {
    console.warn("pickPhotos failed", error);
    return [];
  }
}

// ---- Storing the chosen photos for a given stat, per the user's storage mode ----
async function storePhotosForPerf(rawBlobs, perfId) {
  const mode = getPhotoStorageMode();
  const results = [];
  for (const rawBlob of rawBlobs.slice(0, 2)) {
    const blob = await compressImage(rawBlob);
    const id = crypto.randomUUID();
    if (mode === "cloud" && auth.currentUser) {
      const path = `proofs/${auth.currentUser.uid}/${perfId}/${id}.jpg`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(ref);
      results.push({ id, mode: "cloud", url, storagePath: path });
    } else {
      await putPhotoBlob(id, blob);
      results.push({ id, mode: "local" });
    }
  }
  return results;
}

function deleteProofPhotos(photos) {
  (photos || []).forEach((photo) => {
    if (photo.mode === "cloud" && photo.storagePath) {
      deleteObject(storageRef(storage, photo.storagePath)).catch(() => {});
    } else if (photo.mode === "local") {
      deletePhotoBlob(photo.id).catch(() => {});
    }
  });
}
window.deleteProofPhotos = deleteProofPhotos;

// ---- "Add proofs to this stat?" prompt, shown right after a stat is added ----
const proofPromptModal = document.getElementById("proof-prompt-modal");
const proofPromptYesBtn = document.getElementById("proof-prompt-yes-btn");
const proofPromptNoBtn = document.getElementById("proof-prompt-no-btn");

function showProofPromptModal() {
  return new Promise((resolve) => {
    proofPromptModal.hidden = false;
    function onYes() {
      cleanup(true);
    }
    function onNo() {
      cleanup(false);
    }
    function cleanup(result) {
      proofPromptModal.hidden = true;
      proofPromptYesBtn.removeEventListener("click", onYes);
      proofPromptNoBtn.removeEventListener("click", onNo);
      resolve(result);
    }
    proofPromptYesBtn.addEventListener("click", onYes);
    proofPromptNoBtn.addEventListener("click", onNo);
  });
}

async function promptForProofPhotos(perf, onSaved) {
  const wantsPhotos = await showProofPromptModal();
  if (!wantsPhotos) return;
  const rawBlobs = await pickPhotos(2);
  if (!rawBlobs.length) return;
  perf.photos = await storePhotosForPerf(rawBlobs, perf.id);
  onSaved();
}
window.promptForProofPhotos = promptForProofPhotos;

// ---- Fullscreen swipeable viewer ----
const proofViewerEl = document.getElementById("proof-viewer");
const proofViewerTrack = document.getElementById("proof-viewer-track");
const proofViewerCloseBtn = document.getElementById("proof-viewer-close-btn");

async function resolvePhotoSrc(item) {
  if (typeof item === "string") return item;
  if (item.mode === "cloud") return item.url;
  const blob = await getPhotoBlob(item.id);
  return blob ? URL.createObjectURL(blob) : null;
}

async function openProofViewer(photos) {
  if (!photos || !photos.length) return;
  proofViewerTrack.innerHTML = "";
  for (const item of photos) {
    const src = await resolvePhotoSrc(item);
    if (!src) continue;
    const img = document.createElement("img");
    img.className = "proof-viewer-img";
    img.src = src;
    proofViewerTrack.appendChild(img);
  }
  if (!proofViewerTrack.children.length) return;
  proofViewerEl.hidden = false;
}
window.openProofViewer = openProofViewer;

function closeProofViewer() {
  proofViewerEl.hidden = true;
  proofViewerTrack.innerHTML = "";
}
proofViewerCloseBtn.addEventListener("click", closeProofViewer);
proofViewerEl.addEventListener("click", (e) => {
  if (e.target === proofViewerEl) closeProofViewer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !proofViewerEl.hidden) closeProofViewer();
});

// ---- Profile > Confidentialité (share toggle) + Stockage (cloud/local) ----
const profileViewForSettings = document.getElementById("profile-view");
const profilePrivacyRow = document.getElementById("profile-privacy-row");
const privacyViewEl = document.getElementById("privacy-view");
const privacyBackBtn = document.getElementById("privacy-back-btn");
const proofsShareToggle = document.getElementById("proofs-share-toggle");

const profileStorageRow = document.getElementById("profile-storage-row");
const storageViewEl = document.getElementById("storage-view");
const storageBackBtn = document.getElementById("storage-back-btn");
const proofsStorageRows = document.querySelectorAll(".proofs-storage-row");
const proofsStorageNoteEl = document.getElementById("proofs-storage-note");

function updateProofsRows() {
  const sharing = getShareProofs();
  proofsShareToggle.classList.toggle("active", sharing);
  proofsShareToggle.setAttribute("aria-checked", String(sharing));

  const mode = getPhotoStorageMode();
  proofsStorageRows.forEach((row) => {
    const active = row.dataset.storageMode === mode;
    row.classList.toggle("active", active);
    const check = row.querySelector(".theme-row-check");
    if (check) check.textContent = active ? "✓" : "";
  });
  proofsStorageNoteEl.textContent = t(mode === "local" ? "proofs.storageLocalNote" : "proofs.storageCloudNote");
}

profilePrivacyRow.addEventListener("click", () => {
  profileViewForSettings.hidden = true;
  privacyViewEl.hidden = false;
});
privacyBackBtn.addEventListener("click", () => {
  privacyViewEl.hidden = true;
  profileViewForSettings.hidden = false;
});
profileStorageRow.addEventListener("click", () => {
  profileViewForSettings.hidden = true;
  storageViewEl.hidden = false;
});
storageBackBtn.addEventListener("click", () => {
  storageViewEl.hidden = true;
  profileViewForSettings.hidden = false;
});
document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    privacyViewEl.hidden = true;
    storageViewEl.hidden = true;
  });
});
proofsShareToggle.addEventListener("click", () => {
  setShareProofs(!getShareProofs());
  updateProofsRows();
});
proofsStorageRows.forEach((row) => {
  row.addEventListener("click", () => {
    setPhotoStorageMode(row.dataset.storageMode);
    updateProofsRows();
  });
});
document.addEventListener("languagechange", updateProofsRows);

updateProofsRows();
