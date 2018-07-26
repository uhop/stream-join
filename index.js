'use strict';

const {Readable} = require('stream');

const join = (streams, options) => {
  const result = new Readable(
    Object.assign({}, options, {
      objectMode: true,
      read() {
        !filled && streams.forEach(s => s.resume());
      }
    })
  );

  if (!options || !options.skipEvents) {
    streams.forEach(s => s.on('error', error => result.emit('error', error)));
  }

  streams.forEach(s => s.pause());

  let items = new Array(streams.length),
    filled = 0,
    done = 0;
  items.fill(null);

  const onData = index => item => {
    items[index] = item;
    ++filled;
    if (filled + done === items.length) {
      streams.forEach((s, i) => i !== index && items[i] !== null && s.resume());
      result.push(items);
      items = new Array(streams.length);
      items.fill(null);
      filled = 0;
    } else {
      streams[index].pause();
    }
  };

  const onEnd = () => {
    ++done;
    if (filled && filled + done === items.length) {
      streams.forEach((s, i) => items[i] !== null && s.resume());
      result.push(items);
      items = new Array(streams.length);
      items.fill(null);
      filled = 0;
    }
    if (done === items.length) {
      result.push(null);
    }
  };

  streams.forEach((s, i) => {
    s.on('data', onData(i));
    s.on('end', onEnd);
  });

  return result;
};

module.exports = join;
