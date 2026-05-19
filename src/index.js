// @ts-self-types="./index.d.ts"

'use strict';

// `stream-join` is being reorganized into a multi-component package
// (`zip()`, `select()`, …). For now the default export points to `zip()`,
// preserving the 2.0.x public API: `require('stream-join')` returns the
// zip function exactly as before.

module.exports = require('./zip.js');
