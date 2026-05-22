// @ts-self-types="./index.d.ts"

// Web entry point. Default export = `zip()` (mirrors the Node entry default
// for `import join from 'stream-join/web'`). Named exports cover the
// multi-component surface.

import zip from './zip.js';

export default zip;
export {zip};
export {default as select} from './select.js';
export {default as race} from './race.js';
export {default as concat} from './concat.js';
