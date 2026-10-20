// Generates a sample DB-shaped object so the user can see the new structures.
import { buildSeed } from '../assets/js/services/seed.js';
import { MEASURE_FIELDS } from '../assets/js/services/measurements.js';

// localStorage shim so the seed can run
globalThis.localStorage = {
  _s: new Map(),
  getItem(k) { return this._s.get(k) ?? null; },
  setItem(k, v) { this._s.set(k, v); },
  removeItem(k) { this._s.delete(k); },
};

const db = buildSeed();
const s = db.students[0];
const meas = db.measurements.filter((m) => m.studentId === s.id).slice(0, 3);

console.log('===== ALUMNO (uno completo) =====');
console.log(JSON.stringify(s, null, 2));

console.log('\n===== MEDICIÓN (ejemplo, sin estatura) =====');
console.log(JSON.stringify(meas[0], null, 2));

console.log('\n===== MEASURE_FIELDS actual =====');
console.log(MEASURE_FIELDS.map((f) => `${f.key} (${f.unit})`).join(', '));

console.log('\n===== INDICES calculados para la última medición =====');
const last = meas[meas.length - 1];
const h = s.heightCm / 100;
const imc = last.weightKg / (h * h);
const ice = last.waistCm / s.heightCm;
const icc = last.waistCm / last.hipCm;
const imcBand = imc < 18.5 ? 'Bajo peso' : imc < 25 ? 'Normal' : imc < 30 ? 'Sobrepeso' : imc < 35 ? 'Obesidad I' : imc < 40 ? 'Obesidad II' : 'Obesidad III';
const iceBand = ice < 0.40 ? 'Delgado' : ice < 0.50 ? 'Saludable' : ice < 0.60 ? 'Sobrepeso abd.' : 'Obesidad abd.';
console.log(`Estatura: ${s.heightCm} cm (fija en alumno, sexo: ${s.sex})`);
console.log(`Peso:     ${last.weightKg} kg`);
console.log(`Cintura:  ${last.waistCm} cm`);
console.log(`Cadera:   ${last.hipCm} cm`);
console.log(`→ IMC:    ${imc.toFixed(2)} (${imcBand})`);
console.log(`→ ICE:    ${ice.toFixed(2)} (${iceBand})`);
console.log(`→ ICC:    ${icc.toFixed(2)} (umbrales ${s.sex === 'F' ? 'mujer' : 'varón'})`);
