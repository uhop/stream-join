// @ts-self-types="./index.d.ts"

// Web entry point. Default export = `zip()` (mirrors the Node entry default
// for `import join from 'stream-join/web'`). Named exports cover the
// multi-component surface.

import zip from './zip.js';

export default zip;
export {zip};
export {select} from './select.js';
export {race} from './race.js';
export {concat} from './concat.js';
