// Pure + Web-Streams test helpers. Importing this file must not pull `node:*`
// — these helpers are reused by Web tests under `tests/web/`.

export const webStreamFromArray = array => {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < array.length) controller.enqueue(array[i++]);
      else controller.close();
    }
  });
};

export const collectWebStream = async stream => {
  const out = [];
  const reader = stream.getReader();
  for (;;) {
    const {value, done} = await reader.read();
    if (done) return out;
    out.push(value);
  }
};

// Externally-driven ReadableStream — the Web-side analog of the Node
// `PassThrough` in tests/helpers.js. Tests use it to write items into a stream
// piecewise (sequential, interleaved, error-emit) and observe how a combinator
// reacts. The queue is unbounded (the controller buffers everything written
// until consumed), which is fine for the small inputs the tests use.
export const webPassThrough = () => {
  let _controller;
  const readable = new ReadableStream({
    start(c) {
      _controller = c;
    }
  });
  return {
    readable,
    write(value) {
      _controller.enqueue(value);
    },
    end() {
      _controller.close();
    },
    error(reason) {
      _controller.error(reason);
    }
  };
};

// Build a ReadableStream whose `pull` always errors with the given reason
// (after an optional delay). Web-side analog of tests/node/test-errors.js's
// `erroringStream` helper.
export const erroringWebStream = (error, delayMs = 0) =>
  new ReadableStream({
    pull(controller) {
      if (delayMs > 0) setTimeout(() => controller.error(error), delayMs);
      else controller.error(error);
    }
  });
