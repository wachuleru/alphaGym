/* ===========================================================
   ALPHA-FIT — Health indices (IMC, ICE, ICC)
   Pure functions. No DOM, no storage.
   =========================================================== */

/* ----- IMC (kg / m²) ---------------------------------------- */

/** OMS classification for Body Mass Index. */
export const IMC_BANDS = [
  { id: 'under',  label: 'Bajo peso',     min: 0,   max: 18.5, color: '#3b82f6', risk: 'Riesgo de deficiencias nutricionales' },
  { id: 'normal', label: 'Normal',        min: 18.5, max: 25,   color: '#22c55e', risk: 'Riesgo mínimo o estándar' },
  { id: 'over',   label: 'Sobrepeso',     min: 25,   max: 30,   color: '#eab308', risk: 'Riesgo moderadamente incrementado' },
  { id: 'obese1', label: 'Obesidad I',    min: 30,   max: 35,   color: '#f97316', risk: 'Riesgo alto' },
  { id: 'obese2', label: 'Obesidad II',   min: 35,   max: 40,   color: '#ef4444', risk: 'Riesgo muy alto' },
  { id: 'obese3', label: 'Obesidad III',  min: 40,   max: Infinity, color: '#7f1d1d', risk: 'Riesgo extremo / Mórbida' },
];

export function computeIMC(weightKg, heightCm) {
  const w = Number(weightKg);
  const h = Number(heightCm) / 100;
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return null;
  return w / (h * h);
}

export function classifyIMC(imc) {
  if (imc == null || !Number.isFinite(imc)) return null;
  const band = IMC_BANDS.find((b) => imc >= b.min && imc < b.max) || IMC_BANDS[IMC_BANDS.length - 1];
  return { imc: round(imc, 2), band, label: band.label, color: band.color, risk: band.risk };
}

/* ----- ICE (waist / height) ---------------------------------- */

/** Waist-to-Height ratio bands. Thresholds same for both sexes. */
export const ICE_BANDS = [
  { id: 'skinny',   label: 'Delgado extremo',           min: 0,    max: 0.40, color: '#3b82f6', risk: 'Posible desnutrición' },
  { id: 'healthy',  label: 'Saludable / Riesgo bajo',   min: 0.40, max: 0.50, color: '#22c55e', risk: 'Riesgo bajo' },
  { id: 'over',     label: 'Sobrepeso abdominal',       min: 0.50, max: 0.60, color: '#eab308', risk: 'Riesgo moderado' },
  { id: 'obese',    label: 'Obesidad abdominal',        min: 0.60, max: Infinity, color: '#ef4444', risk: 'Riesgo cardiovascular alto' },
];

export function computeICE(waistCm, heightCm) {
  const w = Number(waistCm);
  const h = Number(heightCm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return null;
  return w / h;
}

export function classifyICE(ice) {
  if (ice == null || !Number.isFinite(ice)) return null;
  const band = ICE_BANDS.find((b) => ice >= b.min && ice < b.max) || ICE_BANDS[ICE_BANDS.length - 1];
  return { ice: round(ice, 2), band, label: band.label, color: band.color, risk: band.risk };
}

/* ----- ICC (waist / hip) — sex-dependent --------------------- */

export const ICC_BANDS = {
  F: [
    { id: 'f-excellent', label: 'Excelente',         min: 0,     max: 0.80, color: '#22c55e', risk: 'Muy bajo' },
    { id: 'f-normal',    label: 'Normal',            min: 0.80,  max: 0.85, color: '#84cc16', risk: 'Bajo' },
    { id: 'f-limit',     label: 'Límite',            min: 0.85,  max: 0.90, color: '#eab308', risk: 'Moderado' },
    { id: 'f-high',      label: 'Alto (Obesidad)',   min: 0.90,  max: Infinity, color: '#ef4444', risk: 'Riesgo cardiovascular elevado' },
  ],
  M: [
    { id: 'm-excellent', label: 'Excelente',         min: 0,     max: 0.85, color: '#22c55e', risk: 'Muy bajo' },
    { id: 'm-normal',    label: 'Normal',            min: 0.85,  max: 0.94, color: '#84cc16', risk: 'Bajo' },
    { id: 'm-limit',     label: 'Límite',            min: 0.94,  max: 1.00, color: '#eab308', risk: 'Moderado' },
    { id: 'm-high',      label: 'Alto (Obesidad)',   min: 1.00,  max: Infinity, color: '#ef4444', risk: 'Riesgo cardiovascular elevado' },
  ],
};

export function computeICC(waistCm, hipCm) {
  const w = Number(waistCm);
  const h = Number(hipCm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return null;
  return w / h;
}

/** `sex` must be 'F' or 'M'. Returns null if sex is missing or unknown. */
export function classifyICC(icc, sex) {
  if (icc == null || !Number.isFinite(icc)) return null;
  const bands = ICC_BANDS[sex];
  if (!bands) return { icc: round(icc, 2), band: null, label: '—', color: '#94a3b8', risk: 'Sexo no definido' };
  const band = bands.find((b) => icc >= b.min && icc < b.max) || bands[bands.length - 1];
  return { icc: round(icc, 2), band, label: band.label, color: band.color, risk: band.risk };
}

/* ----- Helpers ----------------------------------------------- */

function round(n, d) { const f = 10 ** d; return Math.round(n * f) / f; }
