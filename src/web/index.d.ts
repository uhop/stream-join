// Web entry point types. Default export = `zip`; named exports add `select`,
// `race`, `concat`.

import zip from './zip.js';

export default zip;
export {zip};
export {default as select} from './select.js';
export {default as race} from './race.js';
export {default as concat} from './concat.js';
