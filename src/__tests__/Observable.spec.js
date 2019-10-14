import { Observable } from "../Observable";

describe("Observable", () => {
  test("should at least work", () => {
    const source = new Observable((next, error, complete) => {
      next(1);
      next(2);
      next(3);
      complete();
    });

    let results = [];

    source.subscribe(value => results.push(value), null, () =>
      results.push("done")
    );

    expect(results).toEqual([1, 2, 3, "done"]);
  });

  test("should handle firehose", () => {
    let loops = 0;
    const source = new Observable((next, err, complete, signal) => {
      for (let i = 0; i < 100 && !signal.aborted; i++) {
        next(i);
        loops++;
      }
      // this will noop due to protections after abort below
      // which is "unsubscription".
      complete();
    });

    const controller = new AbortController();
    const results = [];

    source.subscribe(
      value => {
        results.push(value);
        if (results.length === 3) {
          // "unsubscribe"
          controller.abort();
        }
      },
      null,
      // complete should not be called, because of the
      // abort (unsubscription) above
      () => results.push("done"),
      controller.signal
    );

    expect(loops).toBe(3);
    expect(results).toEqual([0, 1, 2]);
  });

  test("a basic interval", done => {
    /**
     * This test is a bit non-deterministic because of the
     * use of `setInterval` and `setTimeout`. It's mostly
     * meant to show usage.
     */
    const source = new Observable((next, error, complete, signal) => {
      let n = 0;
      const id = setInterval(() => {
        next(n++);
      }, 100);

      signal.addEventListener("abort", () => {
        clearInterval(id);
      });
    });

    const controller = new AbortController();
    const results = [];

    source.subscribe(
      value => results.push(value),
      null,
      null,
      controller.signal
    );

    setTimeout(() => {
      controller.abort();
      expect(results).toEqual([0, 1, 2, 3, 4]);
      done();
    }, 550);
  });
});
