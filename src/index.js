// @ts-self-types="./index.d.ts"

// Node entry point. Default export = `zip()` (preserves the 1.x → 2.x bridge:
// `import join from 'stream-join'` keeps working). Named exports cover the
// multi-component surface.

import zip from './zip.js';

export default zip;
export {zip};
export {select} from './select.js';
export {race} from './race.js';
export {concat} from './concat.js';
