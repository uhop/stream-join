// Web entry point types. Default export = `zip`; named exports add `select`,
// `race`, `concat`.

import zip from './zip.js';

export default zip;
export {zip};
export {select} from './select.js';
export {race} from './race.js';
export {concat} from './concat.js';
