/**
 * Copyright 2019 Ben Lesh <ben@benlesh.com>
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
export class Observable {
  constructor(_init) {
    this._init = _init;
  }

  subscribe(nextHandler, errorHandler, completeHandler, signal) {
    let isAborting = false;
    const controller = createChildAbortController(signal);
    const subscriptionSignal = controller.signal;

    const canEmit = () => !isAborting && !subscriptionSignal.aborted;

    const next = value => {
      if (canEmit()) {
        nextHandler && nextHandler(value);
      }
    };

    const error = err => {
      if (canEmit()) {
        isAborting = true;
        if (errorHandler) {
          errorHandler(err);
        } else {
          hostReportError(err);
        }
        controller.abort();
      }
    };

    const complete = () => {
      if (canEmit()) {
        isAborting = true;
        completeHandler && completeHandler();
        controller.abort();
      }
    };

    this._init(next, error, complete, subscriptionSignal);
  }

  forEach(nextHandler, signal) {
    return new Promise((resolve, reject) => {
      this.subscribe(
        value => {
          try {
            nextHandler(value);
          } catch (err) {
            reject(err);
          }
        },
        reject,
        resolve,
        signal
      );
    });
  }

  last(signal) {
    return new Promise((resolve, reject) => {
      let last = undefined;
      this.subscribe(
        value => (last = value),
        reject,
        () => resolve(last),
        signal
      );
    });
  }

  first(signal) {
    return new Promise((resolve, reject) => {
      const controller = createChildAbortController(signal);

      this.subscribe(
        value => {
          resolve(value);
          controller.abort();
        },
        reject,
        () => reject(new Error("No first value")),
        controller.signal
      );
    });
  }

  [Symbol.asyncIterator]() {
    let done = false;
    let error = null;
    let queue = [];
    let dequeue = [];

    this.subscribe(
      val => {
        queue.push(val);
      },

      err => {
        error = err;
      },

      () => {
        done = true;
      },
    );

    async function next() {
      if (dequeue.length > 0) {
        const value = dequeue.pop();

        return { value, done: false };
      }

      if (queue.length > 0) {
        dequeue = queue.reverse();
        queue = [];

        return next();
      }

      if (error) {
        throw error;
      }

      if (done) {
        return { done };
      }

      await nextTick();
      return next();
    }

    return {
      next,
    };
  }
}

function nextTick() {
  return new Promise(resolve => globalThis.setTimeout(resolve));
}

function createChildAbortController(signal) {
  const controller = new AbortController();
  signal && signal.addEventListener("abort", () => controller.abort());
  return controller;
}

function hostReportError(err) {
  setTimeout(() => {
    throw err;
  });
}
