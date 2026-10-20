// Tests for the health indices service.
import { computeIMC, classifyIMC, computeICE, classifyICE, computeICC, classifyICC, IMC_BANDS, ICE_BANDS } from '../assets/js/services/health.js';

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('  OK ', msg);
}

console.log('IMC:');
assert(computeIMC(70, 170)?.toFixed(2) === '24.22', 'IMC 70kg/1.70m ≈ 24.22 (normal)');
assert(computeIMC(50, 170)?.toFixed(2) === '17.30', 'IMC 50kg/1.70m ≈ 17.30 (bajo peso)');
assert(computeIMC(90, 170)?.toFixed(2) === '31.14', 'IMC 90kg/1.70m ≈ 31.14 (obesidad I)');
assert(computeIMC(120, 170)?.toFixed(2) === '41.52', 'IMC 120kg/1.70m ≈ 41.52 (obesidad III)');
assert(computeIMC(0, 170) === 0, 'IMC 0kg/1.70m = 0 (caso degenerado)');
assert(computeIMC(70, 0) === null, 'IMC null con estatura 0');
assert(computeIMC('abc', 170) === null, 'IMC null con peso no numérico');

console.log('classifyIMC:');
assert(classifyIMC(17).label === 'Bajo peso', 'IMC 17 → Bajo peso');
assert(classifyIMC(22).label === 'Normal',    'IMC 22 → Normal');
assert(classifyIMC(27).label === 'Sobrepeso', 'IMC 27 → Sobrepeso');
assert(classifyIMC(32).label === 'Obesidad I', 'IMC 32 → Obesidad I');
assert(classifyIMC(37).label === 'Obesidad II', 'IMC 37 → Obesidad II');
assert(classifyIMC(45).label === 'Obesidad III', 'IMC 45 → Obesidad III');
assert(classifyIMC(null) === null, 'classifyIMC(null) → null');

console.log('ICE:');
assert(computeICE(80, 170)?.toFixed(2) === '0.47', 'ICE 80/170 ≈ 0.47 (saludable)');
assert(computeICE(100, 170)?.toFixed(2) === '0.59', 'ICE 100/170 ≈ 0.59 (sobrepeso abdominal)');
assert(computeICE(110, 170)?.toFixed(2) === '0.65', 'ICE 110/170 ≈ 0.65 (obesidad abdominal)');
assert(computeICE(60, 170)?.toFixed(2) === '0.35', 'ICE 60/170 ≈ 0.35 (delgado extremo)');

console.log('classifyICE:');
assert(classifyICE(0.35).label === 'Delgado extremo',     'ICE 0.35 → Delgado extremo');
assert(classifyICE(0.45).label.startsWith('Saludable'),    'ICE 0.45 → Saludable');
assert(classifyICE(0.55).label === 'Sobrepeso abdominal',  'ICE 0.55 → Sobrepeso abdominal');
assert(classifyICE(0.70).label === 'Obesidad abdominal',   'ICE 0.70 → Obesidad abdominal');

console.log('ICC:');
assert(computeICC(80, 100)?.toFixed(2) === '0.80', 'ICC 80/100 = 0.80 (límite mujer)');
assert(computeICC(90, 100)?.toFixed(2) === '0.90', 'ICC 90/100 = 0.90 (alto mujer)');
assert(computeICC(90, 100)?.toFixed(2) === '0.90', 'ICC 90/100 = 0.90 (normal varón)');
assert(computeICC(100, 100)?.toFixed(2) === '1.00', 'ICC 100/100 = 1.00 (alto varón)');

console.log('classifyICC sex-dependent:');
assert(classifyICC(0.83, 'F').label === 'Normal',     'ICC 0.83 F → Normal');
assert(classifyICC(0.83, 'M').label === 'Excelente',  'ICC 0.83 M → Excelente');
assert(classifyICC(0.88, 'F').label === 'Límite',     'ICC 0.88 F → Límite');
assert(classifyICC(0.88, 'M').label === 'Normal',     'ICC 0.88 M → Normal');
assert(classifyICC(0.92, 'F').label === 'Alto (Obesidad)', 'ICC 0.92 F → Alto');
assert(classifyICC(0.92, 'M').label === 'Normal',     'ICC 0.92 M → Normal');
assert(classifyICC(0.95, 'F').label === 'Alto (Obesidad)', 'ICC 0.95 F → Alto');
assert(classifyICC(0.95, 'M').label === 'Límite',     'ICC 0.95 M → Límite');
assert(classifyICC(1.05, 'M').label === 'Alto (Obesidad)', 'ICC 1.05 M → Alto');
const noSex = classifyICC(0.85, '');
assert(noSex && noSex.label === '—', 'ICC sin sexo → label "—"');

console.log('Bands shape:');
assert(IMC_BANDS.length === 6, '6 bandas IMC');
assert(ICE_BANDS.length === 4, '4 bandas ICE');
assert(IMC_BANDS.every((b) => b.color && b.label && b.risk), 'Todas las bandas IMC tienen color/label/risk');

console.log('\nAll health indices tests passed.');
