'use strict';

const unit = require('heya-unit');

const join = require('../index');
const {streamFromArray, streamToArray, PassThrough} = require('./helpers');

unit.add(module, [
  function test_simple3(t) {
    const async = t.startAsync('test_simple3');

    const output = [],
      result = join([streamFromArray([1, 2, 3]), streamFromArray(['a', 'b', 'c']), streamFromArray(['A', 'B', 'C'])]).pipe(streamToArray(output));

    result.on('finish', () => {
      eval(t.TEST('t.unify(output, [[1, "a", "A"], [2, "b", "B"], [3, "c", "C"]])'));
      async.done();
    });
  },
  function test_simple2_straight(t) {
    const async = t.startAsync('test_simple2_straight');

    const output = [],
      s1 = new PassThrough(),
      s2 = new PassThrough(),
      result = join([s1, s2]).pipe(streamToArray(output));

    result.on('finish', () => {
      eval(t.TEST('t.unify(output, [[1, "a"], [2, "b"], [3, "c"]])'));
      async.done();
    });

    s2.push('a');
    s2.push('b');
    s2.push('c');
    s2.push(null);
    s1.push(1);
    s1.push(2);
    s1.push(3);
    s1.push(null);
  },
  function test_simple2_mixed(t) {
    const async = t.startAsync('test_simple2_mixed');

    const output = [],
      s1 = new PassThrough(),
      s2 = new PassThrough(),
      result = join([s1, s2]).pipe(streamToArray(output));

    result.on('finish', () => {
      eval(t.TEST('t.unify(output, [[1, "a"], [2, "b"], [3, "c"]])'));
      async.done();
    });

    s2.push('a');
    s1.push(1);
    s1.push(2);
    s2.push('b');
    s2.push('c');
    s2.push(null);
    s1.push(3);
    s1.push(null);
  },
  function test_simple2_uneven1(t) {
    const async = t.startAsync('test_simple2_uneven1');

    const output = [],
      s1 = new PassThrough(),
      s2 = new PassThrough(),
      result = join([s1, s2]).pipe(streamToArray(output));

    result.on('finish', () => {
      eval(t.TEST('t.unify(output, [[1, "a"], [2, "b"], [3, null], [4, null]])'));
      async.done();
    });

    s2.push('a');
    s1.push(1);
    s1.push(2);
    s2.push('b');
    s1.push(3);
    s2.push(null);
    s1.push(4);
    s1.push(null);
  },
  function test_simple2_uneven2(t) {
    const async = t.startAsync('test_simple2_uneven2');

    const output = [],
      s1 = new PassThrough(),
      s2 = new PassThrough(),
      result = join([s1, s2]).pipe(streamToArray(output));

    result.on('finish', () => {
      eval(t.TEST('t.unify(output, [[1, "a"], [2, "b"], [null, "c"], [null, "d"]])'));
      async.done();
    });

    s2.push('a');
    s1.push(1);
    s2.push('b');
    s1.push(2);
    s2.push('c');
    s2.push('d');
    s2.push(null);
    s1.push(null);
  }
]);
