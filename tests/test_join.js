'use strict';

const unit = require('heya-unit');

const join = require('../index');
const {streamFromArray, streamToArray} = require('./helpers');

unit.add(module, [
  function test_join3(t) {
    const async = t.startAsync('test_join3');

    const output = [],
      result = join([streamFromArray([1, 2, 3]), streamFromArray(['a', 'b', 'c']), streamFromArray(['A', 'B', 'C'])], {
        joinItems(output, items) {
          output.push(items.join('-'));
        }
      }).pipe(streamToArray(output));

    result.on('finish', () => {
      eval(t.TEST('t.unify(output, ["1-a-A", "2-b-B", "3-c-C"])'));
      async.done();
    });
  },
  function test_join2(t) {
    const async = t.startAsync('test_join2');

    const output = [],
      result = join([streamFromArray([1, 2, 3]), streamFromArray(['a', 'b'])], {
        joinItems(output, items) {
          items[0] !== null && output.push(items[0]);
          items[1] !== null && output.push(items[1]);
        }
      }).pipe(streamToArray(output));

    result.on('finish', () => {
      eval(t.TEST('t.unify(output, [1, "a", 2, "b", 3])'));
      async.done();
    });
  }
]);
