'use strict';

const {Readable} = require('stream');

const join = (streams, options) => {
  const output = new Readable(
    Object.assign({}, options, {
      objectMode: true,
      read() {
        !filled && streams.forEach(s => s.resume());
      }
    })
  );

  if (!options || !options.skipEvents) {
    streams.forEach(s => s.on('error', error => output.emit('error', error)));
  }

  const joinItems = options && typeof options.joinItems == 'function' ? options.joinItems : ((output, items) => output.push(items));

  streams.forEach(s => s.pause());

  let items = new Array(streams.length),
    filled = 0,
    done = 0;
  items.fill(null);

  const processItems = index => {
    streams.forEach((s, i) => i !== index && items[i] !== null && s.resume());
    joinItems(output, items);
    items = new Array(streams.length);
    items.fill(null);
    filled = 0;
  };

  const onData = index => item => {
    items[index] = item;
    ++filled;
    if (filled + done === items.length) {
      processItems(index);
    } else {
      streams[index].pause();
    }
  };

  const onEnd = () => {
    ++done;
    if (filled && filled + done === items.length) {
      processItems(-1);
    }
    if (done === items.length) {
      output.push(null);
    }
  };

  streams.forEach((s, i) => {
    s.on('data', onData(i));
    s.on('end', onEnd);
  });

  return output;
};

module.exports = join;
