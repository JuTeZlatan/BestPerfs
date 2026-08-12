// ---- Unit preferences (weight: kg/lb, distance: km+m / mi+yd) ----
// Everything is stored canonically (kg, km, m) regardless of the user's
// chosen display unit; conversion only happens at render/input time.
const WEIGHT_UNIT_KEY = "exercise-tracker-weight-unit";
const DISTANCE_UNIT_KEY = "exercise-tracker-distance-unit";

const KG_PER_LB = 0.45359237;
const KM_PER_MI = 1.609344;
const M_PER_YD = 0.9144;

function getWeightUnit() {
  return localStorage.getItem(WEIGHT_UNIT_KEY) || "kg";
}

function getDistanceUnit() {
  return localStorage.getItem(DISTANCE_UNIT_KEY) || "km";
}

function roundTo(value, decimals) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function weightToDisplay(kg) {
  if (kg == null || kg === "") return kg;
  return getWeightUnit() === "lb" ? roundTo(kg / KG_PER_LB, 1) : kg;
}

function weightFromDisplay(value) {
  if (value == null || value === "") return value;
  const kg = getWeightUnit() === "lb" ? value * KG_PER_LB : value;
  return roundTo(kg, 2);
}

function weightUnitLabel() {
  return getWeightUnit() === "lb" ? "lb" : "kg";
}

function kmToDisplay(km) {
  if (km == null || km === "") return km;
  return getDistanceUnit() === "mi" ? roundTo(km / KM_PER_MI, 2) : km;
}

function kmFromDisplay(value) {
  if (value == null || value === "") return value;
  const km = getDistanceUnit() === "mi" ? value * KM_PER_MI : value;
  return roundTo(km, 3);
}

function kmUnitLabel() {
  return getDistanceUnit() === "mi" ? "mi" : "km";
}

function mToDisplay(m) {
  if (m == null || m === "") return m;
  return getDistanceUnit() === "mi" ? roundTo(m / M_PER_YD, 1) : m;
}

function mFromDisplay(value) {
  if (value == null || value === "") return value;
  const m = getDistanceUnit() === "mi" ? value * M_PER_YD : value;
  return roundTo(m, 1);
}

function mUnitLabel() {
  return getDistanceUnit() === "mi" ? "yd" : "m";
}

window.getWeightUnit = getWeightUnit;
window.getDistanceUnit = getDistanceUnit;
window.weightToDisplay = weightToDisplay;
window.weightFromDisplay = weightFromDisplay;
window.weightUnitLabel = weightUnitLabel;
window.kmToDisplay = kmToDisplay;
window.kmFromDisplay = kmFromDisplay;
window.kmUnitLabel = kmUnitLabel;
window.mToDisplay = mToDisplay;
window.mFromDisplay = mFromDisplay;
window.mUnitLabel = mUnitLabel;

// ---- Preferences UI (Profil > Unités) ----
const profileUnitsRow = document.getElementById("profile-units-row");
const profileViewForUnits = document.getElementById("profile-view");
const unitsViewEl = document.getElementById("units-view");
const unitsBackBtn = document.getElementById("units-back-btn");
const unitWeightKgBtn = document.getElementById("unit-weight-kg-btn");
const unitWeightLbBtn = document.getElementById("unit-weight-lb-btn");
const unitDistanceKmBtn = document.getElementById("unit-distance-km-btn");
const unitDistanceMiBtn = document.getElementById("unit-distance-mi-btn");

profileUnitsRow.addEventListener("click", () => {
  profileViewForUnits.hidden = true;
  unitsViewEl.hidden = false;
});

unitsBackBtn.addEventListener("click", () => {
  unitsViewEl.hidden = true;
  profileViewForUnits.hidden = false;
});

document.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    unitsViewEl.hidden = true;
  });
});

function updateUnitButtons() {
  const w = getWeightUnit();
  const d = getDistanceUnit();
  unitWeightKgBtn.classList.toggle("active", w === "kg");
  unitWeightLbBtn.classList.toggle("active", w === "lb");
  unitDistanceKmBtn.classList.toggle("active", d === "km");
  unitDistanceMiBtn.classList.toggle("active", d === "mi");
}

function setWeightUnit(unit) {
  if (unit === getWeightUnit()) return;
  localStorage.setItem(WEIGHT_UNIT_KEY, unit);
  updateUnitButtons();
  document.dispatchEvent(new CustomEvent("unitschange"));
}

function setDistanceUnit(unit) {
  if (unit === getDistanceUnit()) return;
  localStorage.setItem(DISTANCE_UNIT_KEY, unit);
  updateUnitButtons();
  document.dispatchEvent(new CustomEvent("unitschange"));
}

unitWeightKgBtn.addEventListener("click", () => setWeightUnit("kg"));
unitWeightLbBtn.addEventListener("click", () => setWeightUnit("lb"));
unitDistanceKmBtn.addEventListener("click", () => setDistanceUnit("km"));
unitDistanceMiBtn.addEventListener("click", () => setDistanceUnit("mi"));

updateUnitButtons();
