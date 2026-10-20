// Quick smoke test: import every module to catch top-level syntax/import errors.
// This does NOT execute browser-only logic; it just verifies importability.

import { SCHEMA_VERSION, STORAGE_KEY, APP_NAME, LEVELS, BADGES } from '../assets/js/config.js';
import { uid, todayISO, fmtCLP, esc } from '../assets/js/utils.js';

console.log('config OK:', { SCHEMA_VERSION, APP_NAME, levels: LEVELS.length, badges: BADGES.length });
console.log('utils OK:', { today: todayISO(), sample: fmtCLP(1234567), uid: uid('test') });
console.log('esc OK:', esc('<script>alert(1)</script>'));
